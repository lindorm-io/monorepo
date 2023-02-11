import { AuthenticationSession, MfaCookieSession } from "../../entity";
import { Environments } from "@lindorm-io/common-types";
import { MFA_COOKIE_NAME } from "../../constant";
import { ServerKoaContext } from "../../types";
import { calculateLevelOfAssurance, getMethodsFromStrategies } from "../../util";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";

export const generateMfaCookie = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
): Promise<void> => {
  const {
    cache: { mfaCookieSessionCache },
  } = ctx;

  const expires = expiryDate(configuration.defaults.mfa_cookie_expiry);
  const { level } = calculateLevelOfAssurance(authenticationSession);
  const methods = getMethodsFromStrategies(authenticationSession.confirmedStrategies);

  if (!authenticationSession.identityId) {
    throw new Error("Identity ID not found");
  }

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
    signed: ctx.server.environment !== Environments.TEST,
  });
};
