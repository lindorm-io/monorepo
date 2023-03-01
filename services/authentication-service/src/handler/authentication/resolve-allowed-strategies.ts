import { Account, AuthenticationSession } from "../../entity";
import { BROWSER_LINK_COOKIE_NAME, MFA_COOKIE_NAME } from "../../constant";
import { ServerKoaContext } from "../../types";
import { getAvailableStrategies } from "../../util";
import { getValidDeviceLinks } from "./get-valid-device-links";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";
import { AuthenticationStrategy } from "@lindorm-io/common-types";

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
    availableStrategies.includes(AuthenticationStrategy.BANK_ID_SE) &&
    authenticationSession.country === "se"
  ) {
    strategies.push(AuthenticationStrategy.BANK_ID_SE);
  }

  // Device Link Challenge

  if (availableStrategies.includes(AuthenticationStrategy.DEVICE_CHALLENGE) && deviceLinks.length) {
    strategies.push(AuthenticationStrategy.DEVICE_CHALLENGE);
  }

  // Email

  if (availableStrategies.includes(AuthenticationStrategy.EMAIL_CODE)) {
    strategies.push(AuthenticationStrategy.EMAIL_CODE);
  }

  if (availableStrategies.includes(AuthenticationStrategy.EMAIL_OTP)) {
    strategies.push(AuthenticationStrategy.EMAIL_OTP);
  }

  // MFA Cookies

  if (
    availableStrategies.includes(AuthenticationStrategy.MFA_COOKIE) &&
    ctx.cookies.get(MFA_COOKIE_NAME, { signed: true })
  ) {
    strategies.push(AuthenticationStrategy.MFA_COOKIE);
  }

  // Password

  const browserLinkCookie = ctx.cookies.get(BROWSER_LINK_COOKIE_NAME, { signed: true });

  if (availableStrategies.includes(AuthenticationStrategy.PASSWORD) && !browserLinkCookie) {
    strategies.push(AuthenticationStrategy.PASSWORD);
  }

  if (
    availableStrategies.includes(AuthenticationStrategy.PASSWORD_BROWSER_LINK) &&
    browserLinkCookie
  ) {
    strategies.push(AuthenticationStrategy.PASSWORD_BROWSER_LINK);
  }

  // Phone OTP

  if (availableStrategies.includes(AuthenticationStrategy.PHONE_OTP)) {
    strategies.push(AuthenticationStrategy.PHONE_OTP);
  }

  // Remote Device Challenge

  if (
    availableStrategies.includes(AuthenticationStrategy.RDC_PUSH_NOTIFICATION) &&
    deviceLinks.length
  ) {
    strategies.push(AuthenticationStrategy.RDC_PUSH_NOTIFICATION);
  }

  if (availableStrategies.includes(AuthenticationStrategy.RDC_QR_CODE)) {
    strategies.push(AuthenticationStrategy.RDC_QR_CODE);
  }

  // Sessions

  if (
    availableStrategies.includes(AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE) &&
    sessions.length
  ) {
    strategies.push(AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE);
  }

  if (availableStrategies.includes(AuthenticationStrategy.SESSION_OTP) && sessions.length) {
    strategies.push(AuthenticationStrategy.SESSION_OTP);
  }

  // Time Based OTP

  if (availableStrategies.includes(AuthenticationStrategy.TIME_BASED_OTP) && !!account?.totp) {
    strategies.push(AuthenticationStrategy.TIME_BASED_OTP);
  }

  // WebAuthN

  if (availableStrategies.includes(AuthenticationStrategy.WEBAUTHN)) {
    strategies.push(AuthenticationStrategy.WEBAUTHN);
  }

  logger.debug("Resolved strategies", { strategies });

  return strategies;
};
