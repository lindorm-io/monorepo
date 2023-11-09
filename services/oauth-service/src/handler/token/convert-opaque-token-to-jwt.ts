import { SubjectHint } from "@lindorm-io/common-enums";
import { JwtSign } from "@lindorm-io/jwt";
import { randomUnreserved } from "@lindorm-io/random";
import { getUnixTime } from "date-fns";
import { ClientSession, OpaqueToken } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

export const convertOpaqueTokenToJwt = (
  ctx: ServerKoaContext,
  clientSession: ClientSession,
  opaqueToken: OpaqueToken,
): JwtSign => {
  const { jwt } = ctx;

  return jwt.sign({
    id: opaqueToken.id,
    adjustedAccessLevel: getAdjustedAccessLevel(clientSession),
    audiences: clientSession.audiences,
    authorizedParty: clientSession.clientId,
    authTime: getUnixTime(clientSession.latestAuthentication),
    client: clientSession.clientId,
    expiry: opaqueToken.expires,
    issuedAt: opaqueToken.created,
    levelOfAssurance: clientSession.levelOfAssurance,
    nonce: clientSession.nonce || randomUnreserved(16),
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
