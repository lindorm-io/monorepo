import { Account, LoginSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { calculateAllowedFlows } from "./calculate-allowed-flows";
import { getValidIdentityDeviceLinks } from "./get-valid-identity-device-links";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";
import { calculateAllowedOidcProviders } from "../../util";

export const resolveAllowedFlows = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  account?: Account,
): Promise<LoginSession> => {
  if (!loginSession.deviceLinks.length) {
    loginSession.deviceLinks = await getValidIdentityDeviceLinks(ctx, account);
  }

  if (!loginSession.sessions.length) {
    loginSession.sessions = await getValidIdentitySessions(ctx, account);
  }

  loginSession.allowedFlows = calculateAllowedFlows(ctx, loginSession, account);
  loginSession.allowedOidc = calculateAllowedOidcProviders(loginSession);

  return loginSession;
};
