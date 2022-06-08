import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TOTPHandler } from "../../class";
import { configuration } from "../../server/configuration";
import { vaultGetSalt } from "../../handler";

interface RequestData {
  totp: string;
}

export const deleteAccountTotpSchema = Joi.object<RequestData>()
  .keys({
    totp: Joi.string().required(),
  })
  .required();

export const deleteAccountTotpController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { totp },
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  const salt = await vaultGetSalt(ctx, account);
  const totpHandler = new TOTPHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  totpHandler.assert(totp, account.totp);

  account.totp = null;

  await accountRepository.update(account);
};
