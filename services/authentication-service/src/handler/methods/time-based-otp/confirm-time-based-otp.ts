import { Account, AuthenticationSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { TOTPHandler } from "../../../class";
import { configuration } from "../../../server/configuration";
import { fetchAccountSalt } from "../../vault-service";

interface Options {
  totp: string;
}

export const confirmTimeBasedOtp = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { totp } = options;

  logger.debug("Verifying Account");

  const account = await accountRepository.find({ id: authenticationSession.identityId });

  if (!account.totp) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have TOTP",
    });
  }

  logger.debug("Verifying TOTP");

  const salt = await fetchAccountSalt(ctx, account);
  const totpHandler = new TOTPHandler({
    aes: { secret: salt.aes },
    issuer: configuration.server.issuer,
  });

  await totpHandler.assert(totp, account.totp);

  return account;
};
