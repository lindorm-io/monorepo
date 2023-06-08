import { LindormIdentityClaims } from "@lindorm-io/common-types";
import { JwtVerify } from "@lindorm-io/jwt";
import { BrowserSession, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const tryFindClientSession = async (
  ctx: ServerKoaContext,
  client: Client,
  browserSession?: BrowserSession,
  idToken?: JwtVerify<LindormIdentityClaims>,
): Promise<ClientSession | undefined> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (idToken?.metadata.session) {
    return await clientSessionRepository.tryFind({ id: idToken.metadata.session });
  }

  if (!client || !browserSession) return;

  return await clientSessionRepository.tryFind({
    browserSessionId: browserSession.id,
    clientId: client.id,
  });
};
