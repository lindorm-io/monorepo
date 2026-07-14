import type { PylonHttpMiddleware } from "../../types/index.js";
import { appendChallenge } from "../utils/challenge/append-challenge.js";

export const httpChallengeMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.challenge = (scheme, params) => appendChallenge(ctx, scheme, params);

  await next();
};
