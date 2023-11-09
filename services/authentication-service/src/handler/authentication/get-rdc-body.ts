import { HttpMethod, RdcSessionMode } from "@lindorm-io/common-enums";
import { InitialiseRdcSessionRequestBody } from "@lindorm-io/common-types";
import { createURL } from "@lindorm-io/url";
import { AuthenticationSession, StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { createStrategySessionToken } from "../index";

export const getRdcBody = (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): InitialiseRdcSessionRequestBody => {
  if (!strategySession.nonce) throw new Error("Session initialised without nonce");

  return {
    audiences: [configuration.oauth.client_id],
    confirmMethod: HttpMethod.POST,
    confirmPayload: {
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
      visualHint: strategySession.visualHint,
    },
    confirmUri: createURL("/sessions/strategy/:id/confirm", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    expiresAt: authenticationSession.expires.toISOString(),
    factors: 2,
    mode: RdcSessionMode.QR_CODE,
    nonce: strategySession.nonce,
    rejectMethod: HttpMethod.POST,
    rejectUri: createURL("/sessions/strategy/:id/reject", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    scopes: ["authentication"],
    templateName: "authentication",
  };
};
