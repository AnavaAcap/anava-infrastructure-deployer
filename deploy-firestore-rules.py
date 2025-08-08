#!/usr/bin/env python3
import requests
import json
import subprocess
import base64

# Get access token
result = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True)
access_token = result.stdout.strip()

project_id = 'testdada-n73m'

# Read the rules file
with open('firestore-rules/firestore.rules', 'r') as f:
    rules_content = f.read()

print("Deploying Firestore rules to project:", project_id)
print("Rules preview (first 500 chars):")
print(rules_content[:500])
print("...")

# Create a ruleset
url = f'https://firebaserules.googleapis.com/v1/projects/{project_id}/rulesets'
headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}

# Create the ruleset
ruleset_data = {
    'source': {
        'files': [
            {
                'name': 'firestore.rules',
                'content': rules_content
            }
        ]
    }
}

print("\nCreating ruleset...")
response = requests.post(url, headers=headers, json=ruleset_data)
if response.status_code != 200:
    print(f"Error creating ruleset: {response.status_code}")
    print(response.text)
    exit(1)

ruleset_name = response.json()['name']
print(f"Created ruleset: {ruleset_name}")

# Now release the ruleset to Firestore
release_url = f'https://firebaserules.googleapis.com/v1/projects/{project_id}/releases'
release_data = {
    'name': f'projects/{project_id}/releases/cloud.firestore',
    'rulesetName': ruleset_name
}

print("\nReleasing ruleset to Firestore...")
response = requests.patch(f'{release_url}/cloud.firestore', headers=headers, json=release_data)
if response.status_code != 200:
    print(f"Error releasing ruleset: {response.status_code}")
    print(response.text)
    exit(1)

print("✅ Firestore rules deployed successfully!")
print("\n⚠️  IMPORTANT: These rules are temporarily relaxed for testing!")
print("Remember to revert to secure rules after fixing the authentication flow.")