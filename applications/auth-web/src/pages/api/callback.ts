import type { NextApiRequest, NextApiResponse } from "next";
import Cookies from "cookies";
import { oauthClient } from "../../backend/axios";
import { axiosBasicAuthMiddleware } from "@lindorm-io/axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = new Cookies(req, res);

  if (req.query.error) {
    return res.status(400).json({ error: req.query });
  }

  const state = cookies.get("oauth_state");
  const codeVerifier = cookies.get("oauth_code_verifier");

  if (req.query.state !== state) {
    return res.status(400).json({ message: "Invalid state" });
  }

  const { code } = req.query;

  const response = await oauthClient.post("/oauth2/token", {
    body: {
      code,
      codeVerifier,
      grantType: "authorization_code",
      redirectUri: "http://localhost:4100/api/callback",
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
      ].join(" "),
    },
    middleware: [
      axiosBasicAuthMiddleware({
        username: "1061f927-d799-487d-bc30-0061dff84447",
        password: "t3WZCoXASEkk5PTh8hQ_ThOySjbYz7hhHauyz0ZtMelW5TDGt2UhbDctFoD-KAU8",
      }),
    ],
  });

  cookies.set("oauth_state");
  cookies.set("oauth_nonce");
  cookies.set("oauth_code_verifier");

  return res.status(200).json(response.data);
}
