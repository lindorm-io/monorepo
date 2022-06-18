import { AuthenticationSession, MfaCookieSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { MFA_COOKIE_NAME } from "../../constant";
import { configuration } from "../../server/configuration";
import { getExpiryDate } from "@lindorm-io/core";

export const generateMfaCookie = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
): Promise<void> => {
  const {
    cache: { mfaCookieSessionCache },
  } = ctx;

  const expires = getExpiryDate(configuration.defaults.mfa_cookie_expiry);

  const mfaCookieSession = await mfaCookieSessionCache.create(
    new MfaCookieSession({
      expires,
      identityId: authenticationSession.identityId,
      levelOfAssurance: authenticationSession.confirmedLevelOfAssurance,
      methods: authenticationSession.confirmedMethods,
    }),
  );

  ctx.setCookie(MFA_COOKIE_NAME, mfaCookieSession.id, {
    expiry: expires,
  });
};
