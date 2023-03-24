import { BrowserSession, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { VerifiedIdentityToken } from "../../common";

export const tryFindClientSession = async (
  ctx: ServerKoaContext,
  client: Client,
  browserSession?: BrowserSession,
  idToken?: VerifiedIdentityToken,
): Promise<ClientSession | undefined> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (idToken?.session) {
    return await clientSessionRepository.tryFind({ id: idToken.session });
  }

  if (!client || !browserSession) return;

  return await clientSessionRepository.tryFind({
    browserSessionId: browserSession.id,
    clientId: client.id,
  });
};
