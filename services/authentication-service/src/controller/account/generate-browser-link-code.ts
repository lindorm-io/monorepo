import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { getRandomString } from "@lindorm-io/core";
import { fetchAccountSalt } from "../../handler";

interface ResponseBody {
  code: string;
}

export const generateBrowserLinkCodeController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  if (account.browserLinkCode) {
    throw new ClientError("Unauthorized", {
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  const code = [
    getRandomString(2).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(4).toUpperCase(),
    getRandomString(6).toUpperCase(),
    getRandomString(4).toUpperCase(),
    getRandomString(6).toUpperCase(),
  ].join("-");

  account.browserLinkCode = await crypto.encrypt(code);

  await accountRepository.update(account);

  return { body: { code } };
};
