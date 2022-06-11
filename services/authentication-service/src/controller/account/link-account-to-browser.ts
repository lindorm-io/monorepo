import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { vaultGetSalt } from "../../handler";
import { BROWSER_LINK_COOKIE_NAME } from "../../constant";
import { getExpiryDate } from "@lindorm-io/core";
import { BrowserLink } from "../../entity";

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
    repository: { browserLinkRepository },
  } = ctx;

  const salt = await vaultGetSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await crypto.assert(code, account.browserLinkCode);
  await crypto.assert(password, account.password);

  const browserLink = await browserLinkRepository.create(
    new BrowserLink({
      accountId: account.id,
      browser: agent.browser,
      environment: client.environment,
      os: agent.os,
      platform: agent.platform,
    }),
  );

  ctx.setCookie(BROWSER_LINK_COOKIE_NAME, browserLink.id, {
    expiry: getExpiryDate("99 years"),
  });
};
