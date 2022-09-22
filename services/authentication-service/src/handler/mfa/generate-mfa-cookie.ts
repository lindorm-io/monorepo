import { AuthenticationSession, MfaCookieSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { MFA_COOKIE_NAME } from "../../constant";
import { configuration } from "../../server/configuration";
import { getExpiryDate } from "@lindorm-io/core";
import { calculateLevelOfAssurance, getMethodsFromStrategies } from "../../util";
import { Environment } from "@lindorm-io/koa";

export const generateMfaCookie = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
): Promise<void> => {
  const {
    cache: { mfaCookieSessionCache },
  } = ctx;

  const expires = getExpiryDate(configuration.defaults.mfa_cookie_expiry);
  const { level } = calculateLevelOfAssurance(authenticationSession);
  const methods = getMethodsFromStrategies(authenticationSession.confirmedStrategies);

  const mfaCookieSession = await mfaCookieSessionCache.create(
    new MfaCookieSession({
      expires,
      identityId: authenticationSession.identityId,
      levelOfAssurance: level,
      methods,
    }),
  );

  ctx.cookies.set(MFA_COOKIE_NAME, mfaCookieSession.id, {
    expires,
    httpOnly: true,
    overwrite: true,
    signed: ctx.metadata.environment !== Environment.TEST,
  });
};
