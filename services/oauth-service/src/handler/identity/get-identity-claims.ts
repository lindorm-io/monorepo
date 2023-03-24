import { ClaimsSession, Client, ClientSession } from "../../entity";
import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
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
  const middleware = [
    axiosBearerAuthMiddleware(
      generateServerCredentialsJwt(ctx, [configuration.services.identity_service.client_id]),
    ),
  ];

  const { data: identityClaims } = await identityClient.get<
    GetClaimsResponse,
    never,
    GetClaimsQuery
  >(configuration.redirect.claims, { query, middleware });

  let extraClaims: Record<string, any> = {};

  if (client.claimsUri) {
    ({ data: extraClaims } = await axiosClient.get(client.claimsUri, { query, middleware }));
  }

  await claimsSessionCache.destroy(claimsSession);

  return { ...identityClaims, ...extraClaims };
};
