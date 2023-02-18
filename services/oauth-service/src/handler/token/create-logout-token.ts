import { AccessSession, Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";

export const createLogoutToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: AccessSession | RefreshSession,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    claims: {
      events: {
        "http://schemas.openid.net/event/backchannel-logout": {},
      },
    },
    client: client.id,
    expiry: "60 seconds",
    session: session.id,
    sessionHint: session instanceof AccessSession ? SessionHint.ACCESS : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHints.IDENTITY,
    tenant: client.tenantId,
    type: LindormTokenTypes.LOGOUT,
  });
};
