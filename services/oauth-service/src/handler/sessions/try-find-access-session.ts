import { AccessSession, BrowserSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { VerifiedIdentityToken } from "../../common";

export const tryFindAccessSession = async (
  ctx: ServerKoaContext,
  client: Client,
  browserSession?: BrowserSession,
  idToken?: VerifiedIdentityToken,
): Promise<AccessSession | undefined> => {
  const {
    repository: { accessSessionRepository },
  } = ctx;

  if (idToken?.session && idToken?.sessionHint === SessionHint.ACCESS) {
    return await accessSessionRepository.tryFind({ id: idToken.session });
  }

  if (!client || !browserSession) return;

  return await accessSessionRepository.tryFind({
    browserSessionId: browserSession.id,
    clientId: client.id,
  });
};
