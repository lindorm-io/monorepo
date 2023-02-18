import { BrowserSession, Client, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { VerifiedIdentityToken } from "../../common";

export const tryFindRefreshSession = async (
  ctx: ServerKoaContext,
  client: Client,
  browserSession?: BrowserSession,
  idToken?: VerifiedIdentityToken,
): Promise<RefreshSession | undefined> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (idToken?.session && idToken?.sessionHint === SessionHint.REFRESH) {
    return await refreshSessionRepository.tryFind({ id: idToken.session });
  }

  if (!browserSession) return;

  return await refreshSessionRepository.tryFind({
    browserSessionId: browserSession.id,
    clientId: client.id,
  });
};
