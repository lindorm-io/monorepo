import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { Middleware } from "@lindorm-io/koa";

export const loginSessionCookieMiddleware: Middleware<Context> = async (
  ctx,
  next,
): Promise<void> => {
  const {
    cache: { loginSessionCache },
  } = ctx;

  const id = ctx.getCookie(LOGIN_SESSION_COOKIE_NAME);

  if (!id) {
    throw new ClientError("Invalid Login session", {
      code: "invalid_request",
      debug: { id },
    });
  }

  try {
    ctx.entity.loginSession = await loginSessionCache.find({ id });
  } catch (err) {
    throw new ClientError("Invalid Login session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
