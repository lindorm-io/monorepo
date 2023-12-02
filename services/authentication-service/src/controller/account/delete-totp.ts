import { ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { TotpHandler } from "../../class";
import { fetchAccountSalt } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

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
    mongo: { accountRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const totpHandler = new TotpHandler({
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
