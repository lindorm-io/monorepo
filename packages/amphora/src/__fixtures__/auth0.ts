export const OPEN_ID_CONFIGURATION_RESPONSE = {
  issuer: "https://lindorm.eu.auth0.com/",
  authorization_endpoint: "https://lindorm.eu.auth0.com/authorize",
  token_endpoint: "https://lindorm.eu.auth0.com/oauth/token",
  device_authorization_endpoint: "https://lindorm.eu.auth0.com/oauth/device/code",
  userinfo_endpoint: "https://lindorm.eu.auth0.com/userinfo",
  mfa_challenge_endpoint: "https://lindorm.eu.auth0.com/mfa/challenge",
  jwks_uri: "https://lindorm.eu.auth0.com/.well-known/jwks.json",
  registration_endpoint: "https://lindorm.eu.auth0.com/oidc/register",
  revocation_endpoint: "https://lindorm.eu.auth0.com/oauth/revoke",
  scopes_supported: [
    "openid",
    "profile",
    "offline_access",
    "name",
    "given_name",
    "family_name",
    "nickname",
    "email",
    "email_verified",
    "picture",
    "created_at",
    "identities",
    "phone",
    "address",
  ],
  response_types_supported: [
    "code",
    "token",
    "id_token",
    "code token",
    "code id_token",
    "token id_token",
    "code token id_token",
  ],
  code_challenge_methods_supported: ["S256", "plain"],
  response_modes_supported: ["query", "fragment", "form_post"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["HS256", "RS256", "PS256"],
  token_endpoint_auth_methods_supported: [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt",
  ],
  claims_supported: [
    "aud",
    "auth_time",
    "created_at",
    "email",
    "email_verified",
    "exp",
    "family_name",
    "given_name",
    "iat",
    "identities",
    "iss",
    "name",
    "nickname",
    "phone_number",
    "picture",
    "sub",
  ],
  request_uri_parameter_supported: false,
  request_parameter_supported: false,
  token_endpoint_auth_signing_alg_values_supported: ["RS256", "RS384", "PS256"],
};

export const OPEN_ID_JWKS_RESPONSE = {
  keys: [
    {
      kty: "RSA",
      use: "sig",
      n: "w8dT6v3E9Lt2vlulAeQJ_AAzYxvMAjKsSsTHBpwjFcojHQzMSneXVAYKIsvZWUvvG5i3NYFFBKROt-ARJmsfk2rkdrdKxqR2jt1Y21aBQ1xwbvhriqkdJ2aDN5M0z_EqEAtT_yU9_OBrPfRA2Q_Frxiitp7Hy94tbAUrdQ07763KoXfQ3-zEoWHvzx0VtIXo9ZJB688V1BfGOVQbOzL0aLfAE1cVKwhEp8jNXNf41XLCzAlqVPF23vvn4kMM4RPf-VrbXAhxnVIrhkeKWPMRYJfqF7BlUJnZtazdO9CRsm5gTY0dLz7TNq6QmjP9qoGdQFU7QReNJgoTUmmcfOIALw",
      e: "AQAB",
      kid: "iPy9pgzr7cFw1kTuiClWE",
      x5t: "Se70fSkOvv-p7UjtI9rNxLR4SD0",
      x5c: [
        "MIIDCTCCAfGgAwIBAgIJOABrHkCZa6X4MA0GCSqGSIb3DQEBCwUAMCIxIDAeBgNVBAMTF29zcHJleS1kZXYuZXUuYXV0aDAuY29tMB4XDTIwMDcwMTA5MTMyMFoXDTM0MDMxMDA5MTMyMFowIjEgMB4GA1UEAxMXb3NwcmV5LWRldi5ldS5hdXRoMC5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDDx1Pq/cT0u3a+W6UB5An8ADNjG8wCMqxKxMcGnCMVyiMdDMxKd5dUBgoiy9lZS+8bmLc1gUUEpE634BEmax+TauR2t0rGpHaO3VjbVoFDXHBu+GuKqR0nZoM3kzTP8SoQC1P/JT384Gs99EDZD8WvGKK2nsfL3i1sBSt1DTvvrcqhd9Df7MShYe/PHRW0hej1kkHrzxXUF8Y5VBs7MvRot8ATVxUrCESnyM1c1/jVcsLMCWpU8Xbe++fiQwzhE9/5WttcCHGdUiuGR4pY8xFgl+oXsGVQmdm1rN070JGybmBNjR0vPtM2rpCaM/2qgZ1AVTtBF40mChNSaZx84gAvAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFASeeUaY9mUPA0MeRpV6sbneZz3YMA4GA1UdDwEB/wQEAwIChDANBgkqhkiG9w0BAQsFAAOCAQEAu3Y6sygzQHsE4CyPFVKRwj5/QF7x83N0nYKxhkS41mrmrenxK83YAz/vpRaTjqbAHpphOXQE5N3pMtgVQJ8JiH9wryHwTKSE8CLA5kC4wraWZMSpwpwXn97NikI6tGzQmbbSxJkjIxhHWm1t4HcMP6tnYlDUG080JY8MOIAdl25VoO8vUlPgccXY19H+c9URTepdnKw/2xUBbGz2ImSSOgvtzeDXgE19S08Qyv9gMskFVp2HXQUASkvv0W4TdBH73gsKC+hx+mJbnjHxyjvBwjewIBLnwLjlimHzshFPNR5hQ19D+6yOo64PNIPfASFqx6E/BtLtxxO+ij7pBmFLrQ==",
      ],
      alg: "RS256",
    },
    {
      kty: "RSA",
      use: "sig",
      n: "3oax-u7-QhCuPpjbQl25oISCrKql2oBb0TEBzT57WiY0yvTVAFInNOiMfwlHvTiDoavIOtJD7YqJSIitYGl1WVU-0yoUCJXLDUw2jhUFfDY-7RGpL-SbTC68AR2L9excS91pO9mdZL94BtsB4mnGUv4JDiCYDQ691wKlhZ3anT8grBTQ1b-jLvH8Cr3peyizTqtHl1xXA5v71xrokXnyO6IBArOy-8Jv0qYIXGkFHMcsfm_wxTg63XgP99ZH0TAf1XGM0N81fZ_q-VTsYK9bn2SfOjrim_dbSTvyAmPddmr_gIFUHOAWl_bDINpVJJJRoekgixuXn6eY3kF1AIuwjw",
      e: "AQAB",
      kid: "IjICkHcf-qq8_stUQ00IN",
      x5t: "NuWYgxSydGi9CoBUNBrHQLc0_so",
      x5c: [
        "MIIDCTCCAfGgAwIBAgIJB/jow8vrbYtSMA0GCSqGSIb3DQEBCwUAMCIxIDAeBgNVBAMTF29zcHJleS1kZXYuZXUuYXV0aDAuY29tMB4XDTIwMDcwMTA5MTMyMFoXDTM0MDMxMDA5MTMyMFowIjEgMB4GA1UEAxMXb3NwcmV5LWRldi5ldS5hdXRoMC5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDehrH67v5CEK4+mNtCXbmghIKsqqXagFvRMQHNPntaJjTK9NUAUic06Ix/CUe9OIOhq8g60kPtiolIiK1gaXVZVT7TKhQIlcsNTDaOFQV8Nj7tEakv5JtMLrwBHYv17FxL3Wk72Z1kv3gG2wHiacZS/gkOIJgNDr3XAqWFndqdPyCsFNDVv6Mu8fwKvel7KLNOq0eXXFcDm/vXGuiRefI7ogECs7L7wm/SpghcaQUcxyx+b/DFODrdeA/31kfRMB/VcYzQ3zV9n+r5VOxgr1ufZJ86OuKb91tJO/ICY912av+AgVQc4BaX9sMg2lUkklGh6SCLG5efp5jeQXUAi7CPAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFJxXf47GEGWjbj/7g+3ZiAc9Vdh+MA4GA1UdDwEB/wQEAwIChDANBgkqhkiG9w0BAQsFAAOCAQEA0/LuunBCvhHF0DczFxBi5vUJ/XTJAtiH8W0MZwftyI19WIrSVHnWyMvoxjsEIlcEMwPXSvcTcH6YMMKmXgceiR8WTx9DEZHdo25pp3GpySXwAwZPDg3AK5DJXv6YUJA4Br7YngDEu+d/ZKOWJHW7Mw8issbijWcuSYDgtSl/kBHBCcTYdiWPN3GHQrOCwwnkQI0yFp8+T2lz9ykiQ+zl8biX2FHRG06qW5NmGYoWyAdPyKbVmjqezmDptKVkCei7cxAH+jAK8SzQ+7CdwHuqCs5jkvhltjgqcex5PRzgEvpVWjPiXrCavq9GZQlWM9nUV2t5B5w4yovdmPhM63dBdA==",
      ],
      alg: "RS256",
    },
  ],
};