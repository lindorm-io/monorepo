import { Account, AuthenticationSession } from "../../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaContext } from "../../../types";
import { fetchAccountSalt } from "../../vault-service";

interface Options {
  code: string;
}

export const confirmRecoveryCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { code } = options;

  logger.debug("Verifying Account");

  if (!authenticationSession.identityId) {
    throw new ServerError("Invalid authenticationSession", {
      debug: { identityId: authenticationSession.identityId },
    });
  }

  const account = await accountRepository.find({ id: authenticationSession.identityId });

  if (!account.recoveryCode) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have a Recovery Code",
    });
  }

  logger.debug("Verifying Recovery Code");

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await crypto.assert(code, account.recoveryCode);

  account.recoveryCode = null;

  return accountRepository.update(account);
};
