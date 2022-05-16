import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";

export const consentSessionCookieMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    cache: { consentSessionCache },
  } = ctx;

  const id = ctx.getCookie(CONSENT_SESSION_COOKIE_NAME);

  if (!id) {
    throw new ClientError("Invalid Consent session", {
      code: "invalid_request",
      debug: { id },
    });
  }

  try {
    ctx.entity.consentSession = await consentSessionCache.find({ id });
  } catch (err) {
    throw new ClientError("Invalid Consent session", {
      code: "invalid_request",
      error: err,
    });
  }

  await next();
};
