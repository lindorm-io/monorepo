import { SubjectHint } from "@lindorm-io/common-types";
import { JwtSignData } from "@lindorm-io/jwt";
import { randomUnreserved } from "@lindorm-io/random";
import { getUnixTime } from "date-fns";
import { ClientSession, OpaqueToken } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

export const convertOpaqueTokenToJwt = (
  ctx: ServerKoaContext,
  clientSession: ClientSession,
  opaqueToken: OpaqueToken,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    id: opaqueToken.id,
    adjustedAccessLevel: getAdjustedAccessLevel(clientSession),
    audiences: clientSession.audiences,
    authTime: getUnixTime(clientSession.latestAuthentication),
    authorizedParty: clientSession.clientId,
    client: clientSession.clientId,
    expiry: opaqueToken.expires,
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
