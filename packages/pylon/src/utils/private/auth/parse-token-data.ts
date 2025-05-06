import { Aegis, ParsedJwt } from "@lindorm/aegis";
import { ms } from "@lindorm/date";
import { ClientError } from "@lindorm/errors";
import { OpenIdAuthorizeResponseQuery, OpenIdTokenResponse } from "@lindorm/types";
import { randomUUID } from "crypto";
import { PylonAuthConfig, PylonHttpContext, PylonSession } from "../../../types";

type Data = OpenIdTokenResponse | OpenIdAuthorizeResponseQuery;

export const parseTokenData = (
  ctx: PylonHttpContext,
  config: PylonAuthConfig,
  data: Data,
): PylonSession => {
  const tdata = data as OpenIdTokenResponse;

  const session: PylonSession = ctx.state.session ?? {
    id: randomUUID(),
    accessToken: "",
    expiresAt: 0,
    issuedAt: 0,
    scope: [],
    subject: "",
  };

  const expiresIn = data.expiresIn ? data.expiresIn * 1000 : ms(config.tokenExpiry);

  session.issuedAt = Date.now();
  session.expiresAt = data.expiresOn
    ? data.expiresOn * 1000
    : Date.now() + expiresIn * 1000;
  session.scope = tdata.scope ? tdata.scope.split(" ") : session.scope;

  if (data.accessToken) {
    session.accessToken = data.accessToken;

    const parsed = Aegis.isJwt(data.accessToken)
      ? Aegis.parse<ParsedJwt>(data.accessToken)
      : null;

    if (parsed) {
      session.id = parsed.payload.sessionId || session.id;
      session.issuedAt = parsed.payload.issuedAt?.getTime() ?? session.issuedAt;
      session.expiresAt = parsed.payload.expiresAt?.getTime() ?? session.expiresAt;
      session.subject = parsed.payload.subject || session.subject;
    }
  }

  if (data.idToken) {
    session.idToken = data.idToken;

    const parsed = Aegis.parse<ParsedJwt>(data.idToken);

    session.id = parsed.payload.sessionId || session.id;
    session.issuedAt = parsed.payload.issuedAt?.getTime() ?? session.issuedAt;
    session.subject = parsed.payload.subject || session.subject;
  }

  if (tdata.refreshToken) {
    session.refreshToken = tdata.refreshToken;
  }

  if (!session.accessToken.length) {
    throw new ClientError("Access token not found", { debug: { session } });
  }

  return session;
};
