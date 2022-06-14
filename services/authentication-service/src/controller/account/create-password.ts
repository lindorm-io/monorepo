import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { fetchAccountSalt } from "../../handler";

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
    repository: { accountRepository },
  } = ctx;

  if (account.password) {
    throw new ClientError("Bad Request", {
      description: "Password already exists",
    });
  }

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  account.password = await crypto.encrypt(newPassword);

  await accountRepository.update(account);
};
