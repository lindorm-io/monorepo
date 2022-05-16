import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";
import { OIDC_SESSION_COOKIE_NAME } from "../../constant";

export const oidcSessionCookieMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    cache: { oidcSessionCache },
  } = ctx;

  const id = ctx.getCookie(OIDC_SESSION_COOKIE_NAME);

  if (!id) {
    throw new ClientError("Invalid OIDC session", {
      code: "invalid_request",
      debug: { id },
    });
  }

  try {
    ctx.entity.oidcSession = await oidcSessionCache.find({ id });
  } catch (err) {
    throw new ClientError("Invalid OIDC session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
