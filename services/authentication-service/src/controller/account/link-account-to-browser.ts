import { Environment } from "@lindorm-io/common-enums";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { BROWSER_LINK_COOKIE_NAME } from "../../constant";
import { BrowserLink } from "../../entity";
import { fetchAccountSalt } from "../../handler";
import { ServerKoaController } from "../../types";

interface RequestData {
  code: string;
  password: string;
}

export const linkAccountToBrowserSchema = Joi.object<RequestData>()
  .keys({
    code: Joi.string().required(),
    password: Joi.string().required(),
  })
  .required();

export const linkAccountToBrowserController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { code, password },
    entity: { account },
    mongo: { browserLinkRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  if (!account.browserLinkCode) {
    throw new ServerError("Invalid account", {
      debug: { browserLinkCode: account.browserLinkCode },
    });
  }

  await crypto.assert(code, account.browserLinkCode);

  if (!account.password) {
    throw new ServerError("Invalid account", {
      debug: { password: account.password },
    });
  }

  await crypto.assert(password, account.password);

  if (!ctx.userAgent.browser || !ctx.userAgent.os || !ctx.userAgent.platform) {
    throw new ServerError("Invalid agent", {
      debug: { userAgent: ctx.userAgent },
    });
  }

  const browserLink = await browserLinkRepository.create(
    new BrowserLink({
      accountId: account.id,
      browser: ctx.userAgent.browser,
      os: ctx.userAgent.os,
      platform: ctx.userAgent.platform,
    }),
  );

  ctx.cookies.set(BROWSER_LINK_COOKIE_NAME, browserLink.id, {
    expires: expiryDate("99 years"),
    httpOnly: true,
    overwrite: true,
    signed: ctx.server.environment !== Environment.TEST,
  });
};
