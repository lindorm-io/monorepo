import { Account, AuthenticationSession, AuthenticationSessionOptions } from "../../entity";
import { ServerKoaContext } from "../../types";
import { resolveAllowedMethods } from "./resolve-allowed-methods";

export const handleAuthenticationInitialisation = async (
  ctx: ServerKoaContext,
  options: AuthenticationSessionOptions,
): Promise<AuthenticationSession> => {
  const {
    cache: { authenticationSessionCache },
    repository: { accountRepository },
  } = ctx;

  const authenticationSession = new AuthenticationSession(options);

  let account: Account;

  if (options.identityId) {
    account = await accountRepository.tryFind({ id: options.identityId });
  }

  authenticationSession.allowedMethods = await resolveAllowedMethods(
    ctx,
    authenticationSession,
    account,
  );

  return await authenticationSessionCache.create(authenticationSession);
};
