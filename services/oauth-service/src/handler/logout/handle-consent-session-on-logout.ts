import { Context } from "../../types";
import { difference } from "lodash";
import { BrowserSession, Client, RefreshSession } from "../../entity";

export const handleConsentSessionOnLogout = async (
  ctx: Context,
  client: Client,
  session: BrowserSession | RefreshSession,
): Promise<void> => {
  const {
    repository: { consentSessionRepository },
  } = ctx;

  const consentSession = await consentSessionRepository.find({
    clientId: client.id,
    identityId: session.identityId,
  });

  consentSession.sessions = difference(consentSession.sessions, [session.id]);

  if (consentSession.sessions.length) {
    await consentSessionRepository.update(consentSession);
  } else {
    await consentSessionRepository.destroy(consentSession);
  }
};
