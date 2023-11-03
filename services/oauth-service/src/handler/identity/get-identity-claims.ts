import { axiosBasicAuthMiddleware, axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { Dict, GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ClaimsSession, Client, ClientSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateServerCredentialsJwt } from "../token";

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
      identityId: clientSession.identityId,
      latestAuthentication: clientSession.latestAuthentication,
      levelOfAssurance: clientSession.levelOfAssurance,
      metadata: clientSession.metadata,
      methods: clientSession.methods,
      scopes: clientSession.scopes,
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
      axiosBearerAuthMiddleware(
        generateServerCredentialsJwt(ctx, [configuration.services.identity_service.client_id]),
      ),
    ],
  });

  let clientClaims: Dict = {};

  if (client.customClaims.uri) {
    const middleware =
      client.customClaims.username && client.customClaims.password
        ? axiosBasicAuthMiddleware({
            username: client.customClaims.username,
            password: client.customClaims.password,
          })
        : axiosBearerAuthMiddleware(generateServerCredentialsJwt(ctx, [client.id]));

    const { data } = await axiosClient.get<GetClaimsResponse, never, GetClaimsQuery>(
      client.customClaims.uri,
      { query, middleware: [middleware] },
    );

    clientClaims = data;
  }

  await claimsSessionCache.destroy(claimsSession);

  return { ...clientClaims, ...identityClaims };
};
