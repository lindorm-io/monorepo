import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";

export const logoutSessionCookieMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    cache: { logoutSessionCache },
  } = ctx;

  const cookieId = ctx.getCookie(LOGOUT_SESSION_COOKIE_NAME);

  if (!cookieId) {
    throw new ClientError("Invalid Logout Session", {
      code: "invalid_request",
      debug: { cookieId },
    });
  }

  try {
    ctx.entity.logoutSession = await logoutSessionCache.find({ id: cookieId });
  } catch (err) {
    throw new ClientError("Invalid Logout Session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
