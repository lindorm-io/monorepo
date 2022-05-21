import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { TOTPHandler } from "../../../class";
import { configuration } from "../../../server/configuration";
import { vaultGetSalt } from "../../axios";

interface Options {
  totp: string;
}

export const confirmTimeBasedOtpFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { totp } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Account");

  const account = await accountRepository.find({ id: loginSession.identityId });

  if (!account.totp) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have TOTP",
    });
  }

  logger.debug("Verifying TOTP");

  const salt = await vaultGetSalt(ctx, account);

  const totpHandler = new TOTPHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  await totpHandler.assert(totp, account.totp);

  return account;
};
