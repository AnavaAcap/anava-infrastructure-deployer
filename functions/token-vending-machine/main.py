import functions_framework
import os
import requests
import json

STS_ENDPOINT = "https://sts.googleapis.com/v1/token"
IAM_ENDPOINT_TEMPLATE = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{sa_email}:generateAccessToken"

@functions_framework.http
def token_vendor_machine(request):
    wif_pn = os.environ.get("WIF_PROJECT_NUMBER")
    wif_pool = os.environ.get("WIF_POOL_ID")
    wif_prov = os.environ.get("WIF_PROVIDER_ID")
    target_sa = os.environ.get("TARGET_SERVICE_ACCOUNT_EMAIL")
    
    if not all([wif_pn, wif_pool, wif_prov, target_sa]):
        print(f"TVMFn ERR: Missing Env Vars")
        return ("TVM Misconfigured", 500)
    
    if request.method != 'POST':
        return ('Method Not Allowed', 405)
    
    try:
        req_json = request.get_json(silent=True)
        if not req_json:
            return ("Bad Request: No JSON", 400)
        
        fb_id_token = req_json.get("firebase_id_token")
        if not fb_id_token:
            return ("Bad Request: 'firebase_id_token' missing", 400)
        
        print(f"TVMFn: Req to vend token for target SA: {target_sa}")
        
        sts_aud = f"//iam.googleapis.com/projects/{wif_pn}/locations/global/workloadIdentityPools/{wif_pool}/providers/{wif_prov}"
        sts_p = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",
            "subject_token": fb_id_token,
            "audience": sts_aud,
            "scope": "https://www.googleapis.com/auth/cloud-platform",
            "requested_token_type": "urn:ietf:params:oauth:token-type:access_token"
        }
        
        # The TVM function's own SA makes this call to STS
        # It needs roles/iam.serviceAccountTokenCreator on ITSELF
        print(f"TVMFn: Making STS request with audience: {sts_aud}")
        print(f"TVMFn: Firebase ID token (first 50 chars): {fb_id_token[:50]}...")
        
        sts_r = requests.post(STS_ENDPOINT, json=sts_p)
        
        if not sts_r.ok:
            print(f"TVMFn STS ERROR: Status {sts_r.status_code}")
            print(f"TVMFn STS ERROR: Response body: {sts_r.text}")
            sts_r.raise_for_status()
        
        sts_j = sts_r.json()
        fed_at = sts_j.get("access_token")
        
        if not fed_at:
            print(f"TVMFn ERR: No fed token: {sts_r.text}")
            return ("STS Err (No fed_at)", 500)
        
        # The federated access token is then used to impersonate the TARGET_SERVICE_ACCOUNT_EMAIL
        # The WIF principal must have roles/iam.workloadIdentityUser on TARGET_SERVICE_ACCOUNT_EMAIL
        iam_ep = IAM_ENDPOINT_TEMPLATE.format(sa_email=target_sa)
        iam_p = {"scope": ["https://www.googleapis.com/auth/cloud-platform"]}
        iam_h = {"Authorization": f"Bearer {fed_at}", "Content-Type": "application/json"}
        
        sa_r = requests.post(iam_ep, json=iam_p, headers=iam_h)
        sa_r.raise_for_status()
        sa_j = sa_r.json()
        gcp_at = sa_j.get("accessToken")
        
        exp_in = int(sts_j.get("expires_in", 3599))
        
        if not gcp_at:
            print(f"TVMFn ERR: No GCP token: {sa_j}")
            return ("IAM Err (No gcp_at)", 500)
        
        print(f"TVMFn: GCP SA token for {target_sa} OK.")
        return ({"gcp_access_token": gcp_at, "expires_in": exp_in}, 200)
        
    except requests.exceptions.HTTPError as e:
        print(f"TVMFn HTTPError: {e} - Resp: {e.response.text if e.response else 'N/A'}")
        return (f"TVM HTTP Err {e.response.status_code if e.response else ''}", 500)
    except Exception as e:
        print(f"TVMFn Unexpected: {e}")
        return ("TVM Internal Err", 500)