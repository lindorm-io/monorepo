import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { fetchAccountSalt } from "../../handler";
import { ServerKoaController } from "../../types";

interface RequestData {
  password: string;
  newPassword: string;
}

export const updateAccountPasswordSchema = Joi.object<RequestData>()
  .keys({
    password: Joi.string().required(),
    newPassword: Joi.string().required(),
  })
  .required();

export const updateAccountPasswordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { password, newPassword },
    entity: { account },
    mongo: { accountRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  if (!account.password) {
    throw new ServerError("Invalid account", {
      debug: { password: account.password },
    });
  }

  await crypto.assert(password, account.password);

  account.password = await crypto.sign(newPassword);

  await accountRepository.update(account);
};
