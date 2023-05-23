import { OpenIdScope } from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { AuthorizationRequest, Client, ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { ServerKoaContext } from "../../types";

const createClientSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  client: Client,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationRequest.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationRequest.browserSessionId },
    });
  }

  if (
    !authorizationRequest.confirmedLogin.identityId ||
    !authorizationRequest.confirmedLogin.latestAuthentication ||
    !authorizationRequest.confirmedLogin.levelOfAssurance ||
    !authorizationRequest.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedLogin: authorizationRequest.confirmedLogin },
    });
  }

  if (
    !authorizationRequest.confirmedConsent.audiences.length ||
    !authorizationRequest.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationRequest.confirmedConsent },
    });
  }

  return await clientSessionRepository.create(
    new ClientSession({
      audiences: authorizationRequest.confirmedConsent.audiences,
      browserSessionId: authorizationRequest.browserSessionId,
      clientId: client.id,
      identityId: authorizationRequest.confirmedLogin.identityId,
      latestAuthentication: authorizationRequest.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationRequest.confirmedLogin.levelOfAssurance,
      metadata: authorizationRequest.confirmedLogin.metadata,
      methods: authorizationRequest.confirmedLogin.methods,
      nonce: authorizationRequest.nonce,
      scopes: authorizationRequest.confirmedConsent.scopes,
      tenantId: client.tenantId,
      type: authorizationRequest.confirmedConsent.scopes.includes(OpenIdScope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );
};

const updateClientSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  clientSession: ClientSession,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationRequest.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationRequest.browserSessionId },
    });
  }

  if (
    !authorizationRequest.confirmedLogin.identityId ||
    !authorizationRequest.confirmedLogin.latestAuthentication ||
    !authorizationRequest.confirmedLogin.levelOfAssurance ||
    !authorizationRequest.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: {
        confirmedLogin: authorizationRequest.confirmedLogin,
      },
    });
  }

  if (
    !authorizationRequest.confirmedConsent.audiences.length ||
    !authorizationRequest.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationRequest.confirmedConsent },
    });
  }

  clientSession.audiences = uniqArray(
    clientSession.audiences,
    authorizationRequest.confirmedConsent.audiences,
  );

  clientSession.latestAuthentication = authorizationRequest.confirmedLogin.latestAuthentication;

  clientSession.levelOfAssurance =
    authorizationRequest.confirmedLogin.levelOfAssurance > clientSession.levelOfAssurance
      ? authorizationRequest.confirmedLogin.levelOfAssurance
      : clientSession.levelOfAssurance;

  clientSession.methods = uniqArray(
    clientSession.methods,
    authorizationRequest.confirmedLogin.methods,
  );

  clientSession.nonce = authorizationRequest.nonce;

  clientSession.scopes = uniqArray(
    clientSession.scopes,
    authorizationRequest.confirmedConsent.scopes,
  );

  clientSession.type = authorizationRequest.confirmedConsent.scopes.includes(
    OpenIdScope.OFFLINE_ACCESS,
  )
    ? ClientSessionType.REFRESH
    : ClientSessionType.EPHEMERAL;

  return await clientSessionRepository.update(clientSession);
};

export const getUpdatedClientSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  client: Client,
): Promise<ClientSession> => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!authorizationRequest.clientSessionId) {
    return await createClientSession(ctx, authorizationRequest, client);
  }

  const clientSession = await clientSessionRepository.find({
    id: authorizationRequest.clientSessionId,
  });

  if (clientSession.identityId !== authorizationRequest.confirmedLogin.identityId) {
    return await createClientSession(ctx, authorizationRequest, client);
  }

  return await updateClientSession(ctx, authorizationRequest, clientSession);
};
