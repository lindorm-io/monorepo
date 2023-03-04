import { ClientSession, OpaqueToken } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SubjectHint } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";
import { uniqArray } from "@lindorm-io/core";

export const convertOpaqueTokenToJwt = (
  ctx: ServerKoaContext,
  clientSession: ClientSession,
  opaqueToken: OpaqueToken,
  audiences: Array<string> = [],
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    id: opaqueToken.id,
    adjustedAccessLevel: getAdjustedAccessLevel(clientSession),
    audiences: uniqArray(
      ...audiences,
      clientSession.clientId,
      clientSession.audiences,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    authTime: getUnixTime(clientSession.latestAuthentication),
    authorizedParty: clientSession.clientId,
    client: clientSession.clientId,
    expiry: opaqueToken.expires,
    levelOfAssurance: clientSession.levelOfAssurance,
    nonce: clientSession.nonce || randomString(16),
    notBefore: opaqueToken.created,
    scopes: clientSession.scopes,
    session: clientSession.id,
    sessionHint: clientSession.type,
    subject: clientSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    tenant: clientSession.tenantId,
    type: opaqueToken.type,
  });
};
