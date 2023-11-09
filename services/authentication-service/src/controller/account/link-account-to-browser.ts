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
    metadata: { agent, client },
    mongo: { browserLinkRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
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

  if (!agent.browser || !agent.os || !agent.platform) {
    throw new ServerError("Invalid agent", {
      debug: { agent },
    });
  }

  const browserLink = await browserLinkRepository.create(
    new BrowserLink({
      accountId: account.id,
      browser: agent.browser,
      environment: client.environment,
      os: agent.os,
      platform: agent.platform,
    }),
  );

  ctx.cookies.set(BROWSER_LINK_COOKIE_NAME, browserLink.id, {
    expires: expiryDate("99 years"),
    httpOnly: true,
    overwrite: true,
    signed: ctx.server.environment !== Environment.TEST,
  });
};
