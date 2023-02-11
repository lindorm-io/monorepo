import { Account, AuthenticationSession, AuthenticationSessionOptions } from "../../entity";
import { ServerKoaContext } from "../../types";
import { resolveAllowedStrategies } from "./resolve-allowed-strategies";

export const handleAuthenticationInitialisation = async (
  ctx: ServerKoaContext,
  options: AuthenticationSessionOptions,
): Promise<AuthenticationSession> => {
  const {
    cache: { authenticationSessionCache },
    repository: { accountRepository },
  } = ctx;

  const authenticationSession = new AuthenticationSession(options);

  let account: Account | undefined;

  if (options.identityId) {
    account = await accountRepository.tryFind({ id: options.identityId });
  }

  authenticationSession.allowedStrategies = await resolveAllowedStrategies(
    ctx,
    authenticationSession,
    account,
  );

  return await authenticationSessionCache.create(authenticationSession);
};
