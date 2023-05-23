import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ClaimsRequest, ClientSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { generateServerCredentialsJwt } from "../token";

export const getIdentityClaims = async (
  ctx: ServerKoaContext,
  clientSession: ClientSession,
): Promise<GetClaimsResponse> => {
  const {
    axios: { identityClient },
    redis: { claimsRequestCache },
  } = ctx;

  const claimsRequest = await claimsRequestCache.create(
    new ClaimsRequest({
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

  const query = { session: claimsRequest.id };
  const middleware = [
    axiosBearerAuthMiddleware(
      generateServerCredentialsJwt(ctx, [configuration.services.identity_service.client_id]),
    ),
  ];

  const { data } = await identityClient.get<GetClaimsResponse, never, GetClaimsQuery>(
    configuration.redirect.claims,
    { query, middleware },
  );

  await claimsRequestCache.destroy(claimsRequest);

  return data;
};
