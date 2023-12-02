import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { TotpHandler } from "../../class";
import { fetchAccountSalt } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

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
  const totpHandler = new TotpHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  const { signature, uri } = totpHandler.generate();

  account.totp = signature;

  await accountRepository.update(account);

  return { body: { uri } };
};
