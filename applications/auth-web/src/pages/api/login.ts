import Cookies from "cookies";
import type { NextApiRequest, NextApiResponse } from "next";
import { authClient } from "../../backend/axios";
import { camelKeys, createURL, PKCEMethod, randomString } from "@lindorm-io/core";
import { createHash } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = new Cookies(req, res);

  const { sessionId } = camelKeys<Record<string, string>>(req.query);

  const codeVerifier = randomString(43);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const created = await authClient.post("/sessions/authentication", {
    body: {
      codeChallenge,
      codeChallengeMethod,
      oauthSessionId: sessionId,
    },
  });

  cookies.set("authentication_code_verifier", codeVerifier);

  const url = createURL("/authenticate", {
    host: "http://rm.rm",
    query: { sessionId: created.data.id },
  });

  return res.redirect(url.toString().replace("http://rm.rm", ""));
}
