import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";

export const authorizationSessionCookieMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const cookieId = ctx.getCookie(AUTHORIZATION_SESSION_COOKIE_NAME);

  if (!cookieId) {
    throw new ClientError("Invalid Authorization Session", {
      code: "invalid_request",
      debug: { cookieId },
    });
  }

  try {
    ctx.entity.authorizationSession = await authorizationSessionCache.find({
      id: cookieId,
    });
  } catch (err) {
    throw new ClientError("Invalid Authorization Session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
