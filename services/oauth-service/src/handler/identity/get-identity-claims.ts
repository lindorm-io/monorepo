import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ClaimsSession, ClientSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateServerCredentialsJwt } from "../token";

export const getIdentityClaims = async (
  ctx: ServerKoaContext,
  clientSession: ClientSession,
): Promise<GetClaimsResponse> => {
  const {
    axios: { identityClient },
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

  const { data } = await identityClient.get<GetClaimsResponse, never, GetClaimsQuery>(
    configuration.services.identity_service.routes.claims,
    { query, middleware },
  );

  await claimsSessionCache.destroy(claimsSession);

  return data;
};
