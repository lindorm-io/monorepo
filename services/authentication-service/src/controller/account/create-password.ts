import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { fetchAccountSalt } from "../../handler";
import { ServerKoaController } from "../../types";

interface RequestData {
  newPassword: string;
}

export const createPasswordSchema = Joi.object<RequestData>()
  .keys({
    newPassword: Joi.string().required(),
  })
  .required();

export const createPasswordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { newPassword },
    entity: { account },
    mongo: { accountRepository },
  } = ctx;

  if (account.password) {
    throw new ClientError("Bad Request", {
      description: "Password already exists",
    });
  }

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  account.password = await crypto.sign(newPassword);

  await accountRepository.update(account);
};
