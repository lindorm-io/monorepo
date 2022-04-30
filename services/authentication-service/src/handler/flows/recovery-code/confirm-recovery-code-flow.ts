import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../../types";
import { CryptoLayered } from "@lindorm-io/crypto";

interface Options {
  code: string;
}

export const confirmRecoveryCodeFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { code } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Account");

  const account = await accountRepository.find({ id: loginSession.identityId });

  if (!account.recoveryCode) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have a Recovery Code",
    });
  }

  logger.debug("Verifying Recovery Code");

  const cryptoLayered = new CryptoLayered({
    aes: { secret: account.salt.aes },
    sha: { secret: account.salt.sha },
  });

  await cryptoLayered.assert(code, account.recoveryCode);

  account.recoveryCode = null;

  return accountRepository.update(account);
};
