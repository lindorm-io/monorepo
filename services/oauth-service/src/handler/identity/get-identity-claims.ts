import { Middleware, axiosBasicAuthMiddleware } from "@lindorm-io/axios";
import { Dict, GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ClaimsSession, Client, ClientSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateServerBearerAuthMiddleware } from "../token";

export const getIdentityClaims = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): Promise<GetClaimsResponse> => {
  const {
    axios: { axiosClient, identityClient },
    redis: { claimsSessionCache },
  } = ctx;

  const claimsSession = await claimsSessionCache.create(
    new ClaimsSession({
      audiences: clientSession.audiences,
      clientId: clientSession.clientId,
      expires: expiryDate(configuration.defaults.expiry.claims_session),
      factors: clientSession.factors,
      identityId: clientSession.identityId,
      latestAuthentication: clientSession.latestAuthentication,
      levelOfAssurance: clientSession.levelOfAssurance,
      metadata: clientSession.metadata,
      methods: clientSession.methods,
      scopes: clientSession.scopes,
      strategies: clientSession.strategies,
    }),
  );

  const query = { session: claimsSession.id };

  const { data: identityClaims } = await identityClient.get<
    GetClaimsResponse,
    never,
    GetClaimsQuery
  >(configuration.services.identity_service.routes.claims, {
    query,
    middleware: [
      generateServerBearerAuthMiddleware(ctx, [configuration.services.identity_service.client_id]),
    ],
  });

  let clientClaims: Dict = {};

  const { uri, username, password } = client.customClaims;

  if (uri) {
    const middleware: Array<Middleware> = [];

    if (username && password) {
      middleware.push(axiosBasicAuthMiddleware({ username, password }));
    } else {
      middleware.push(generateServerBearerAuthMiddleware(ctx, [client.id]));
    }

    const { data } = await axiosClient.get<GetClaimsResponse, never, GetClaimsQuery>(uri, {
      query,
      middleware,
    });

    clientClaims = data;
  }

  await claimsSessionCache.destroy(claimsSession);

  return { ...clientClaims, ...identityClaims };
};
