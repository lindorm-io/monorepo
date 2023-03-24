import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TOTPHandler } from "../../class";
import { configuration } from "../../server/configuration";
import { fetchAccountSalt } from "../../handler";

interface ResponseBody {
  uri: string;
}

export const generateTotpController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { account },
    mongo: { accountRepository },
  } = ctx;

  if (account.totp) {
    throw new ClientError("Bad Request", {
      description: "Password already exists",
    });
  }

  const salt = await fetchAccountSalt(ctx, account);
  const totpHandler = new TOTPHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  const { signature, uri } = totpHandler.generate();

  account.totp = signature;

  await accountRepository.update(account);

  return { body: { uri } };
};
