import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { fetchAccountSalt } from "../../handler";
import { randomString } from "@lindorm-io/random";

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
    sha: { secret: salt.sha },
  });

  const code = [
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
    randomString(6).toUpperCase(),
  ].join("-");

  account.recoveryCode = await crypto.encrypt(code);

  await accountRepository.update(account);

  return { body: { code } };
};
