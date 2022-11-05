import Cookies from "cookies";
import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { createURL, PKCEMethod, randomString } from "@lindorm-io/core";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = new Cookies(req, res);

  const nonce = randomString(16);
  const state = randomString(16);

  const codeVerifier = randomString(43);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  cookies.set("oauth_nonce", nonce);
  cookies.set("oauth_state", state);
  cookies.set("oauth_code_verifier", codeVerifier);

  const url = createURL("/oauth2/authorize", {
    host: "http://localhost",
    port: 3005,
    query: {
      acrValues: [2, "email"].join(" "),
      clientId: "1061f927-d799-487d-bc30-0061dff84447",
      codeChallenge,
      codeChallengeMethod,
      country: "se",
      display: "page",
      loginHint: "test@lindorm.io",
      nonce,
      redirectUri: "http://localhost:4100/api/callback",
      responseMode: "query",
      responseType: ["code", "id_token", "token"],
      scope: [
        "openid",
        "address",
        "email",
        "phone",
        "profile",
        "accessibility",
        "connected_providers",
        "national_identity_number",
        "social_security_number",
        "username",
        "offline_access",
      ],
      state,
      uiLocales: ["sv-SE", "en-GB"],
    },
  });

  return res.redirect(url.toString());
}
