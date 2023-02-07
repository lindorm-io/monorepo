import { Account, AuthenticationSession } from "../../entity";
import { BROWSER_LINK_COOKIE_NAME, MFA_COOKIE_NAME } from "../../constant";
import { ServerKoaContext } from "../../types";
import { getAvailableStrategies } from "../../util";
import { getValidDeviceLinks } from "./get-valid-device-links";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";
import { AuthenticationStrategies, AuthenticationStrategy } from "@lindorm-io/common-types";

export const resolveAllowedStrategies = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  account?: Account,
): Promise<Array<AuthenticationStrategy>> => {
  const logger = ctx.logger.createChildLogger(["resolveAllowedStrategies"]);

  logger.verbose("Resolving allowed strategies");

  const deviceLinks = await getValidDeviceLinks(ctx, account?.id);
  const sessions = await getValidIdentitySessions(ctx, account?.id);
  const availableStrategies = getAvailableStrategies(authenticationSession);

  logger.debug("Available strategies", { availableStrategies, deviceLinks, sessions });

  const strategies: Array<AuthenticationStrategy> = [];

  // Bank ID SE

  if (
    availableStrategies.includes(AuthenticationStrategies.BANK_ID_SE) &&
    authenticationSession.country === "se"
  ) {
    strategies.push(AuthenticationStrategies.BANK_ID_SE);
  }

  // Device Link Challenge

  if (
    availableStrategies.includes(AuthenticationStrategies.DEVICE_CHALLENGE) &&
    deviceLinks.length
  ) {
    strategies.push(AuthenticationStrategies.DEVICE_CHALLENGE);
  }

  // Email

  if (availableStrategies.includes(AuthenticationStrategies.EMAIL_LINK)) {
    strategies.push(AuthenticationStrategies.EMAIL_LINK);
  }

  if (availableStrategies.includes(AuthenticationStrategies.EMAIL_OTP)) {
    strategies.push(AuthenticationStrategies.EMAIL_OTP);
  }

  // MFA Cookies

  if (
    availableStrategies.includes(AuthenticationStrategies.MFA_COOKIE) &&
    ctx.cookies.get(MFA_COOKIE_NAME, { signed: true })
  ) {
    strategies.push(AuthenticationStrategies.MFA_COOKIE);
  }

  // Password

  const browserLinkCookie = ctx.cookies.get(BROWSER_LINK_COOKIE_NAME, { signed: true });

  if (availableStrategies.includes(AuthenticationStrategies.PASSWORD) && !browserLinkCookie) {
    strategies.push(AuthenticationStrategies.PASSWORD);
  }

  if (
    availableStrategies.includes(AuthenticationStrategies.PASSWORD_BROWSER_LINK) &&
    browserLinkCookie
  ) {
    strategies.push(AuthenticationStrategies.PASSWORD_BROWSER_LINK);
  }

  // Phone OTP

  if (availableStrategies.includes(AuthenticationStrategies.PHONE_OTP)) {
    strategies.push(AuthenticationStrategies.PHONE_OTP);
  }

  // Remote Device Challenge

  if (
    availableStrategies.includes(AuthenticationStrategies.RDC_PUSH_NOTIFICATION) &&
    deviceLinks.length
  ) {
    strategies.push(AuthenticationStrategies.RDC_PUSH_NOTIFICATION);
  }

  if (availableStrategies.includes(AuthenticationStrategies.RDC_QR_CODE)) {
    strategies.push(AuthenticationStrategies.RDC_QR_CODE);
  }

  // Sessions

  if (
    availableStrategies.includes(AuthenticationStrategies.SESSION_ACCEPT_WITH_CODE) &&
    sessions.length
  ) {
    strategies.push(AuthenticationStrategies.SESSION_ACCEPT_WITH_CODE);
  }

  if (availableStrategies.includes(AuthenticationStrategies.SESSION_OTP) && sessions.length) {
    strategies.push(AuthenticationStrategies.SESSION_OTP);
  }

  // Time Based OTP

  if (availableStrategies.includes(AuthenticationStrategies.TIME_BASED_OTP) && !!account?.totp) {
    strategies.push(AuthenticationStrategies.TIME_BASED_OTP);
  }

  // WebAuthN

  if (availableStrategies.includes(AuthenticationStrategies.WEBAUTHN)) {
    strategies.push(AuthenticationStrategies.WEBAUTHN);
  }

  logger.debug("Resolved strategies", { strategies });

  return strategies;
};
