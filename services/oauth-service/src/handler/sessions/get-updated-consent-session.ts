import { AuthorizationSession, BrowserSession, ConsentSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { flatten, uniq } from "lodash";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { SessionStatus } from "../../common";
import { ServerError } from "@lindorm-io/errors";

const assertAuthorizationSession = (authorizationSession: AuthorizationSession): void => {
  if (
    authorizationSession.confirmedConsent.audiences.length &&
    authorizationSession.confirmedConsent.scopes.length
  ) {
    return;
  }

  throw new ServerError("Unexpected session data", {
    description: "Authorization session has invalid consent data",
    debug: {
      confirmedLogin: authorizationSession.confirmedConsent,
    },
  });
};

export const getUpdatedConsentSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): Promise<ConsentSession> => {
  const {
    repository: { consentSessionRepository },
  } = ctx;

  try {
    const consentSession = await consentSessionRepository.find({
      clientId: authorizationSession.clientId,
      identityId: browserSession.identityId,
    });

    consentSession.sessions = uniq(flatten([consentSession.sessions, browserSession.id])).sort();

    if (authorizationSession.status.consent === SessionStatus.SKIP) {
      return await consentSessionRepository.update(consentSession);
    }

    assertAuthorizationSession(authorizationSession);

    consentSession.audiences = uniq(
      flatten([consentSession.audiences, authorizationSession.confirmedConsent.audiences]),
    ).sort();
    consentSession.scopes = uniq(
      flatten([consentSession.scopes, authorizationSession.confirmedConsent.scopes]),
    ).sort();

    return await consentSessionRepository.update(consentSession);
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }

  assertAuthorizationSession(authorizationSession);

  return await consentSessionRepository.create(
    new ConsentSession({
      clientId: authorizationSession.clientId,
      identityId: browserSession.identityId,
      audiences: uniq(authorizationSession.confirmedConsent.audiences).sort(),
      scopes: uniq(authorizationSession.confirmedConsent.scopes).sort(),
      sessions: [browserSession.id],
    }),
  );
};
