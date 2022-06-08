import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { vaultGetSalt } from "../../handler";

interface RequestData {
  currentPassword: string;
  newPassword: string;
}

export const updateAccountPasswordSchema = Joi.object<RequestData>()
  .keys({
    newPassword: Joi.string().required(),
    currentPassword: Joi.string().required(),
  })
  .required();

export const updateAccountPasswordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { currentPassword, newPassword },
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  const salt = await vaultGetSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await crypto.assert(currentPassword, account.password);

  account.password = await crypto.encrypt(newPassword);

  await accountRepository.update(account);
};
