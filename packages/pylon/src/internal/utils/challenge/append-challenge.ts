import { isString } from "@lindorm/is";
import type {
  ChallengeParams,
  ChallengeScheme,
  PylonHttpContext,
} from "../../../types/index.js";
import { serializeChallenge } from "./serialize-challenge.js";

export const appendChallenge = <S extends ChallengeScheme>(
  ctx: PylonHttpContext,
  scheme: S,
  params?: ChallengeParams[S],
): void => {
  const challenge = serializeChallenge(scheme, params);
  const existing = ctx.response.get("WWW-Authenticate");

  // RFC 9110 §11.6.1 — one 401 may advertise several challenges (that is how an
  // endpoint says "Basic OR Bearer"), so append rather than overwrite.
  ctx.set("WWW-Authenticate", existing?.length ? `${existing}, ${challenge}` : challenge);

  if (scheme === "dpop") {
    // RFC 9449 §8 — the nonce is returned in its own header.
    const { nonce } = (params ?? {}) as ChallengeParams["dpop"];

    if (isString(nonce) && nonce.length) {
      ctx.set("DPoP-Nonce", nonce);
    }
  }
};
