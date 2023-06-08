import { OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { JwtSign } from "@lindorm-io/jwt";
import { Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const createLogoutToken = (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): JwtSign => {
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
    session: clientSession.id,
    sessionHint: clientSession.type,
    subject: clientSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    tenant: client.tenantId,
    type: OpenIdTokenType.LOGOUT,
  });
};
