import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { fetchAccountSalt } from "../../handler";
import { getRandomString } from "@lindorm-io/core";

interface ResponseBody {
  code: string;
}

export const generateRecoveryCodeController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  const code = [
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
  ].join("-");

  account.recoveryCode = await crypto.encrypt(code);

  await accountRepository.update(account);

  return { body: { code } };
};
