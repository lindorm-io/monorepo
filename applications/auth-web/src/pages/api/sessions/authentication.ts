import Cookies from "cookies";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { PKCEMethod, randomString } from "@lindorm-io/core";
import { authClient } from "../../../backend/axios";
import { createHash } from "crypto";

const handleGET: NextApiHandler = async (req, res) => {
  const cookies = new Cookies(req, res);

  const response = await authClient.get("/sessions/authentication/:id", {
    params: { id: req.query.session_id },
  });

  if (response.data.code) {
    const codeVerifier = cookies.get("authentication_code_verifier");

    const verified = await authClient.post("/sessions/authentication/:id/verify", {
      params: { id: req.query.session_id },
      body: { code: response.data.code, codeVerifier },
    });

    cookies.set("authentication_code_verifier");

    if (response.data.mode === "oauth") {
      const confirmed = await authClient.post("/sessions/login/:id/confirm", {
        params: { id: req.query.session_id },
        body: { authenticationConfirmationToken: verified.data.authenticationConfirmationToken },
      });

      return res.status(200).json(confirmed.data);
    }

    return res.status(200).json(verified.data);
  }

  return res.status(200).json(response.data);
};

const handlePOST: NextApiHandler = async (req, res) => {
  const cookies = new Cookies(req, res);

  const codeVerifier = randomString(43);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const response = await authClient.post("/sessions/authentication", {
    body: {
      codeChallenge,
      codeChallengeMethod,
      ...req.body,
    },
  });

  cookies.set("authentication_code_verifier", codeVerifier);

  return res.status(200).json(response.data);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return handleGET(req, res);
  }

  if (req.method === "POST") {
    return handlePOST(req, res);
  }

  res.status(405).setHeader("Allow", "GET,POST");
}
