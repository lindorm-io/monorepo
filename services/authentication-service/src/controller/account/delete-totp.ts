import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TOTPHandler } from "../../class";
import { configuration } from "../../server/configuration";
import { fetchAccountSalt } from "../../handler";
import { ServerError } from "@lindorm-io/errors";

interface RequestData {
  totp: string;
}

export const deleteTotpSchema = Joi.object<RequestData>()
  .keys({
    totp: Joi.string().required(),
  })
  .required();

export const deleteTotpController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { totp },
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const totpHandler = new TOTPHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  if (!account.totp) {
    throw new ServerError("Invalid account", {
      debug: { totp: account.totp },
    });
  }

  totpHandler.assert(totp, account.totp);

  account.totp = null;

  await accountRepository.update(account);
};
