import { Account, MfaCookieSession } from "../../entity";
import { Context } from "../../types";
import { MFA_COOKIE_NAME } from "../../constant";
import { configuration } from "../../configuration";
import { getExpires, getExpiryDate } from "@lindorm-io/core";

export const generateMfaCookie = async (ctx: Context, account: Account): Promise<void> => {
  const {
    cache: { mfaCookieSessionCache },
  } = ctx;

  const { expiresIn } = getExpires(configuration.expiry.mfa_cookie);

  const mfaCookieSession = await mfaCookieSessionCache.create(
    new MfaCookieSession({ identityId: account.id }),
    expiresIn,
  );

  ctx.setCookie(
    MFA_COOKIE_NAME,
    mfaCookieSession.id,
    getExpiryDate(configuration.expiry.mfa_cookie),
  );
};
