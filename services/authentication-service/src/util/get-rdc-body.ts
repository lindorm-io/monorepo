import { AuthenticationSession, StrategySession } from "../entity";
import { configuration } from "../server/configuration";
import { createURL } from "@lindorm-io/url";
import {
  InitialiseRdcSessionRequestBody,
  RdcSessionMethods,
  RdcSessionModes,
} from "@lindorm-io/common-types";

export const getRdcBody = (
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  strategySessionToken: string,
): InitialiseRdcSessionRequestBody => {
  if (!strategySession.nonce) throw new Error("Session initialised without nonce");

  return {
    audiences: [configuration.oauth.client_id],
    confirmMethod: RdcSessionMethods.POST,
    confirmPayload: { strategySessionToken },
    confirmUri: createURL("/sessions/strategy/:id/confirm", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    expiresAt: authenticationSession.expires.toISOString(),
    factors: 2,
    mode: RdcSessionModes.QR_CODE,
    nonce: strategySession.nonce,
    rejectMethod: RdcSessionMethods.POST,
    rejectUri: createURL("/sessions/strategy/:id/reject", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    scopes: ["authentication"],
    templateName: "authentication",
  };
};
