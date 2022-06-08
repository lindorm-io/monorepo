import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { vaultGetSalt } from "../../axios";

interface Options {
  code: string;
}

export const confirmRecoveryCodeFlow = async (
  ctx: ServerKoaContext,
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

  const salt = await vaultGetSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await crypto.assert(code, account.recoveryCode);

  account.recoveryCode = null;

  return accountRepository.update(account);
};
