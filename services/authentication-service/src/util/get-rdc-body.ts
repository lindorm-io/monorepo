import { AuthenticationSession, StrategySession } from "../entity";
import { InitialiseRdcSessionRequestData, RdcSessionMode, RequestMethod } from "../common";
import { configuration } from "../server/configuration";
import { createURL } from "@lindorm-io/core";

export const getRdcBody = (
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  strategySessionToken: string,
): InitialiseRdcSessionRequestData => ({
  audiences: [configuration.oauth.client_id],
  confirmMethod: RequestMethod.PUT,
  confirmPayload: { strategySessionToken },
  confirmUri: createURL("/authenticate/flows/:id/confirm", {
    host: configuration.server.host,
    port: configuration.server.port,
    params: { id: authenticationSession.id },
  }).toString(),
  expiresAt: authenticationSession.expires.toISOString(),
  factors: 2,
  mode: RdcSessionMode.QR_CODE,
  nonce: strategySession.nonce,
  rejectMethod: RequestMethod.PUT,
  rejectUri: createURL("/authenticate/flows/:id/reject", {
    host: configuration.server.host,
    port: configuration.server.port,
    params: { id: authenticationSession.id },
  }).toString(),
  scopes: ["authentication"],
  templateName: "authentication",
});
