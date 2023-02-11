import { ServerKoaContext } from "../../types";
import { BrowserSession, Client, ConsentSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

export const tryFindConsentSession = async (
  ctx: ServerKoaContext,
  client: Client,
  browserSession?: BrowserSession,
): Promise<ConsentSession | undefined> => {
  const {
    repository: { consentSessionRepository },
  } = ctx;

  if (!browserSession) {
    return;
  }

  try {
    return await consentSessionRepository.find({
      clientId: client.id,
      identityId: browserSession.identityId,
    });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }
};
