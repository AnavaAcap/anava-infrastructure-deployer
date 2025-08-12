(window.ACAP = window.ACAP || {
  registerLicenseKey: function (e, i) {
    !(function ({ deviceId: e, licenseCode: i }, t, n) {
      const a = new XMLHttpRequest();
      a.open('POST', n),
        a.setRequestHeader('Content-Type', 'application/json'),
        a.setRequestHeader('Accept', 'application/json'),
        a.setRequestHeader(
          'Authorization',
          'Bearer eyJ4NXQiOiJZek0xTnpNek1UTXdNelUwTWprM1lXRXpPV0ZoWVdVMVltTTJOMk15WW1NNU16azROR0kyWVRNd05HSmxZbUl4Wkdaa09HVTFPV0kzWkRjNE56QTNOZyIsImtpZCI6Ill6TTFOek16TVRNd016VTBNamszWVdFek9XRmhZV1UxWW1NMk4yTXlZbU01TXprNE5HSTJZVE13TkdKbFltSXhaR1prT0dVMU9XSTNaRGM0TnpBM05nX1JTMjU2IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJzdmN3c28ydXNhcHBzIiwiYXV0IjoiQVBQTElDQVRJT04iLCJhdWQiOiJvTmlPYTdNQU5YTFNFVFZtSGE2aUI4Z3JIQXNhIiwibmJmIjoxNzI4MzkzNzg0LCJhenAiOiJvTmlPYTdNQU5YTFNFVFZtSGE2aUI4Z3JIQXNhIiwic2NvcGUiOiJhY2FwX2FjYV9zY29wZSIsImlzcyI6Imh0dHBzOlwvXC9ndy1hZG1pbi5hcGkuYXhpcy5jb206NDQzXC9vYXV0aDJcL3Rva2VuIiwiZXhwIjoxNzc1Njk4Nzg0LCJpYXQiOjE3MjgzOTM3ODQsImp0aSI6IjZjOTcwMTE5LTI1NTgtNGFiOS1hYjljLTZhOGUwZjQ4NDIwMCJ9.gPqNKSqK2Nh7qcIrrhyX63mafYNQq-kBvwaiaOZN0XySykoaiHgC68pv4Div2v8HilcxrJ6f5-GT9GZUbBlsXsbGtYhdnCmLUXC-1cLU50gu0wozW6hMzcC51gdDW5NgqReRmAIW2B-IRDYix3mEvF9c9KISMRUC3uJGdlBBOOMQ2OU7v1iYcA3ZNJ5hdCQttw-ic0WUStcZUtWt2dxxbk4wTSiQ7-Etv6zoP69cc2e7S3TGQSjtoZXCcGgJfhDEQpn9aRVjFDpZw5uSTZ_N8j0YKV8_k5fdv9-imliPSVos_1DqPNDX8DjkqV6eHPn6pRw6uWPG2HBMRlhrd1zq7w',
        ),
        (a.onload = () => {
          !(function ({ status: e, response: i }, t) {
            if (((i = JSON.parse(i)), 200 === e)) t({ data: { licenseKey: i, version: '4.9.0' } });
            else {
              const { status: e, errorId: n, originalTrace: a } = i;
              t({ error: { status: e, errorId: n, message: a } });
            }
          })(a, t);
        }),
        a.send(JSON.stringify({ deviceId: e, licenseCode: i }));
    })(
      e,
      (e) => {
        i(e);
      },
      'https://gateway.api.axis.com/info-ext/acap/aca/oldGw/v2/licensekey',
    );
  },
}),
  window.acapAsyncInit && window.acapAsyncInit();
