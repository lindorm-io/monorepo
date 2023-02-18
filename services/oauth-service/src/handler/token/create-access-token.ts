import { AccessSession, Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";
import { uniqArray } from "@lindorm-io/core";

export const createAccessToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: AccessSession | RefreshSession,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    adjustedAccessLevel: getAdjustedAccessLevel(session),
    audiences: uniqArray(
      client.id,
      session.audiences,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    authTime: getUnixTime(session.latestAuthentication),
    client: client.id,
    expiry: client.expiry.accessToken || configuration.defaults.expiry.access_token,
    levelOfAssurance: session.levelOfAssurance,
    nonce: session.nonce || randomString(16),
    scopes: session.scopes,
    session: session.id,
    sessionHint: session instanceof AccessSession ? SessionHint.ACCESS : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHints.IDENTITY,
    tenant: client.tenantId,
    type: LindormTokenTypes.ACCESS,
  });
};
