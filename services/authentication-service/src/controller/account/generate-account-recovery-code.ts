import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { getRandomString } from "@lindorm-io/core";
import { vaultGetSalt } from "../../handler";

interface ResponseBody {
  recoveryCode: string;
}

export const generateAccountRecoveryCodeController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  const salt = await vaultGetSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  const recoveryCode = [
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(6).toUpperCase(),
  ].join("-");

  account.recoveryCode = await crypto.encrypt(recoveryCode);

  await accountRepository.update(account);

  return { body: { recoveryCode } };
};
