import { Environment } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { MFA_COOKIE_NAME } from "../../constant";
import { AuthenticationSession, MfaCookieSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { calculateLevelOfAssurance, getMethodsFromStrategies } from "../../util";

export const generateMfaCookie = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
): Promise<void> => {
  const {
    redis: { mfaCookieSessionCache },
  } = ctx;

  const expires = expiryDate(configuration.defaults.mfa_cookie_expiry);
  const { level } = calculateLevelOfAssurance(authenticationSession);
  const methods = getMethodsFromStrategies(authenticationSession);

  if (!authenticationSession.identityId) {
    throw new Error("Identity ID not found");
  }

  const mfaCookieSession = await mfaCookieSessionCache.create(
    new MfaCookieSession({
      expires,
      identityId: authenticationSession.identityId,
      levelOfAssurance: level,
      methods,
      strategies: authenticationSession.confirmedStrategies,
    }),
  );

  ctx.cookies.set(MFA_COOKIE_NAME, mfaCookieSession.id, {
    expires,
    httpOnly: true,
    overwrite: true,
    signed: ctx.server.environment !== Environment.TEST,
  });
};
