import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../../types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { identityAuthenticateIdentifier } from "../../axios";

interface Options {
  password: string;
}

export const confirmPasswordFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { password } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Identity");

  const { identityId } = await identityAuthenticateIdentifier(ctx, loginSession, flowSession);

  logger.debug("Verifying Account");

  const account = await accountRepository.find({ id: identityId });

  if (!account.password) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have a Recovery Code",
    });
  }

  logger.debug("Verifying Password");

  const cryptoLayered = new CryptoLayered({
    aes: { secret: account.salt.aes },
    sha: { secret: account.salt.sha },
  });

  await cryptoLayered.assert(password, account.password);

  return account;
};
