import { OpenIdGrantType, Scope } from "@lindorm-io/common-enums";
import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { AuthorizationSession, Client, ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { ServerKoaContext } from "../../types";

const createClientSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationSession.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.browserSessionId },
    });
  }

  if (
    !authorizationSession.confirmedLogin.identityId ||
    !authorizationSession.confirmedLogin.latestAuthentication ||
    !authorizationSession.confirmedLogin.levelOfAssurance ||
    !authorizationSession.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedLogin: authorizationSession.confirmedLogin },
    });
  }

  if (
    !authorizationSession.confirmedConsent.audiences.length ||
    !authorizationSession.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationSession.confirmedConsent },
    });
  }

  return await clientSessionRepository.create(
    new ClientSession({
      audiences: authorizationSession.confirmedConsent.audiences,
      authorizationGrant: OpenIdGrantType.AUTHORIZATION_CODE,
      browserSessionId: authorizationSession.browserSessionId,
      clientId: client.id,
      expires: expiryDate("4 years"),
      factors: authorizationSession.confirmedLogin.factors,
      identityId: authorizationSession.confirmedLogin.identityId,
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      metadata: authorizationSession.confirmedLogin.metadata,
      methods: authorizationSession.confirmedLogin.methods,
      nonce: authorizationSession.nonce,
      scopes: authorizationSession.confirmedConsent.scopes,
      strategies: authorizationSession.confirmedLogin.strategies,
      tenantId: client.tenantId,
      type: authorizationSession.confirmedConsent.scopes.includes(Scope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );
};

const updateClientSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  clientSession: ClientSession,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationSession.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.browserSessionId },
    });
  }

  if (
    !authorizationSession.confirmedLogin.identityId ||
    !authorizationSession.confirmedLogin.latestAuthentication ||
    !authorizationSession.confirmedLogin.levelOfAssurance ||
    !authorizationSession.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: {
        confirmedLogin: authorizationSession.confirmedLogin,
      },
    });
  }

  if (
    !authorizationSession.confirmedConsent.audiences.length ||
    !authorizationSession.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationSession.confirmedConsent },
    });
  }

  clientSession.audiences = uniqArray(
    clientSession.audiences,
    authorizationSession.confirmedConsent.audiences,
  );

  clientSession.expires = expiryDate("4 years");

  clientSession.factors = authorizationSession.confirmedLogin.factors;

  clientSession.latestAuthentication = authorizationSession.confirmedLogin.latestAuthentication;

  clientSession.levelOfAssurance =
    authorizationSession.confirmedLogin.levelOfAssurance > clientSession.levelOfAssurance
      ? authorizationSession.confirmedLogin.levelOfAssurance
      : clientSession.levelOfAssurance;

  clientSession.methods = authorizationSession.confirmedLogin.methods;

  clientSession.nonce = authorizationSession.nonce;

  clientSession.scopes = uniqArray(
    clientSession.scopes,
    authorizationSession.confirmedConsent.scopes,
  );

  clientSession.strategies = authorizationSession.confirmedLogin.strategies;

  clientSession.type = authorizationSession.confirmedConsent.scopes.includes(Scope.OFFLINE_ACCESS)
    ? ClientSessionType.REFRESH
    : ClientSessionType.EPHEMERAL;

  return await clientSessionRepository.update(clientSession);
};

export const getUpdatedClientSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationSession.clientSessionId) {
    return await createClientSession(ctx, authorizationSession, client);
  }

  const clientSession = await clientSessionRepository.find({
    id: authorizationSession.clientSessionId,
  });

  if (clientSession.identityId !== authorizationSession.confirmedLogin.identityId) {
    return await createClientSession(ctx, authorizationSession, client);
  }

  return await updateClientSession(ctx, authorizationSession, clientSession);
};
