import { CryptoLayered } from "@lindorm-io/crypto";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import { fetchAccountSalt } from "../../handler";
import { ServerKoaController } from "../../types";

interface ResponseBody {
  code: string;
}

export const generateRecoveryCodeController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { account },
    mongo: { accountRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  const code = [
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
  ].join("-");

  account.recoveryCode = await crypto.sign(code);

  await accountRepository.update(account);

  return { body: { code } };
};
