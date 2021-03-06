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

  const id = ctx.getCookie(LOGOUT_SESSION_COOKIE_NAME);

  if (!id) {
    throw new ClientError("Invalid Logout session", {
      code: "invalid_request",
      debug: { id },
    });
  }

  try {
    ctx.entity.logoutSession = await logoutSessionCache.find({ id });
  } catch (err) {
    throw new ClientError("Invalid Logout session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
