import { Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { uniqArray } from "@lindorm-io/core";

export const createRefreshToken = (
  ctx: ServerKoaContext,
  client: Client,
  refreshSession: RefreshSession,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    id: refreshSession.refreshTokenId,
    audiences: uniqArray(
      client.id,
      refreshSession.audiences,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    client: client.id,
    expiry: refreshSession.expires,
    session: refreshSession.id,
    sessionHint: SessionHint.REFRESH,
    subject: refreshSession.identityId,
    subjectHint: SubjectHints.IDENTITY,
    tenant: client.tenantId,
    type: LindormTokenTypes.REFRESH,
  });
};
