import { Client, AccessSession, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormClaims, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { getUnixTime } from "date-fns";
import { uniqArray } from "@lindorm-io/core";

export const createIdToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: AccessSession | RefreshSession,
  claims: Partial<LindormClaims>,
): JwtSignData => {
  const { jwt } = ctx;
  const { sub, updatedAt, ...rest } = claims;

  return jwt.sign({
    audiences: uniqArray(
      client.id,
      session.audiences,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    authContextClass: [`loa_${session.levelOfAssurance}`],
    authMethodsReference: session.methods,
    authTime: getUnixTime(session.latestAuthentication),
    claims: rest,
    client: client.id,
    expiry: client.expiry.idToken || configuration.defaults.expiry.id_token,
    levelOfAssurance: session.levelOfAssurance,
    nonce: session.nonce,
    scopes: session.scopes,
    session: session.id,
    sessionHint: session instanceof AccessSession ? SessionHint.ACCESS : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    tenant: client.tenantId,
    type: OpenIdTokenType.ID,
  });
};
