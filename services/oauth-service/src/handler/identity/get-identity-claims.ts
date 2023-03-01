import { AccessSession, ClaimsSession, Client, RefreshSession } from "../../entity";
import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { generateServerCredentialsToken } from "../token";

export const getIdentityClaims = async (
  ctx: ServerKoaContext,
  client: Client,
  session: AccessSession | RefreshSession,
): Promise<GetClaimsResponse> => {
  const {
    axios: { axiosClient, identityClient },
    cache: { claimsSessionCache },
  } = ctx;

  const claimsSession = await claimsSessionCache.create(
    new ClaimsSession({
      audiences: session.audiences,
      clientId: session.clientId,
      expires: expiryDate(configuration.defaults.expiry.claims_session),
      identityId: session.identityId,
      latestAuthentication: session.latestAuthentication,
      levelOfAssurance: session.levelOfAssurance,
      metadata: session.metadata,
      methods: session.methods,
      scopes: session.scopes,
    }),
  );

  const query = { session: claimsSession.id };
  const middleware = [
    axiosBearerAuthMiddleware(
      generateServerCredentialsToken(ctx, [configuration.services.identity_service.client_id]),
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
