import { Context } from "../../types";
import { BrowserSession, Client, ConsentSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

export const tryFindConsentSession = async (
  ctx: Context,
  browserSession: BrowserSession | undefined,
  client: Client,
): Promise<ConsentSession | undefined> => {
  const {
    repository: { consentSessionRepository },
  } = ctx;

  if (!browserSession?.identityId) {
    return;
  }

  try {
    return await consentSessionRepository.findOrCreate({
      clientId: client.id,
      identityId: browserSession.identityId,
    });
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }
};
