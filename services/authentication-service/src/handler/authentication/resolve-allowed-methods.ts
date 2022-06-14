import { Account, AuthenticationSession } from "../../entity";
import { AuthenticationMethod } from "../../enum";
import { ServerKoaContext } from "../../types";
import { getValidDeviceLinks } from "./get-valid-device-links";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";
import {
  AUTHENTICATION_METHOD_CONFIG,
  BROWSER_LINK_COOKIE_NAME,
  MFA_COOKIE_NAME,
} from "../../constant";

export const resolveAllowedMethods = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  account?: Account,
): Promise<Array<AuthenticationMethod>> => {
  const deviceLinks = await getValidDeviceLinks(ctx, account?.id);
  const sessions = await getValidIdentitySessions(ctx, account?.id);

  const filteredMethods: Array<AuthenticationMethod> = [];

  for (const config of AUTHENTICATION_METHOD_CONFIG) {
    if (authenticationSession.confirmedMethods.includes(config.name)) continue;
    if (authenticationSession.confirmedMethods.length < config.amrValuesMin) continue;
    if (authenticationSession.confirmedMethods.length > config.amrValuesMax) continue;
    if (authenticationSession.confirmedLevelOfAssurance >= config.valueMax) continue;

    filteredMethods.push(config.name);
  }

  const allowedMethods: Array<AuthenticationMethod> = [];

  // Bank ID SE

  if (
    filteredMethods.includes(AuthenticationMethod.BANK_ID_SE) &&
    authenticationSession.country === "se"
  ) {
    allowedMethods.push(AuthenticationMethod.BANK_ID_SE);
  }

  // Device Link Challenge

  if (filteredMethods.includes(AuthenticationMethod.DEVICE_CHALLENGE) && deviceLinks.length) {
    allowedMethods.push(AuthenticationMethod.DEVICE_CHALLENGE);
  }

  // Email

  if (
    filteredMethods.includes(AuthenticationMethod.EMAIL_LINK) &&
    !authenticationSession.confirmedMethods.includes(AuthenticationMethod.EMAIL_OTP)
  ) {
    allowedMethods.push(AuthenticationMethod.EMAIL_LINK);
  }

  if (
    filteredMethods.includes(AuthenticationMethod.EMAIL_OTP) &&
    !authenticationSession.confirmedMethods.includes(AuthenticationMethod.EMAIL_LINK)
  ) {
    allowedMethods.push(AuthenticationMethod.EMAIL_OTP);
  }

  // MFA Cookies

  if (filteredMethods.includes(AuthenticationMethod.MFA_COOKIE) && ctx.getCookie(MFA_COOKIE_NAME)) {
    allowedMethods.push(AuthenticationMethod.MFA_COOKIE);
  }

  // Password

  if (filteredMethods.includes(AuthenticationMethod.PASSWORD)) {
    allowedMethods.push(AuthenticationMethod.PASSWORD);
  }

  if (
    filteredMethods.includes(AuthenticationMethod.PASSWORD_BROWSER_LINK) &&
    ctx.getCookie(BROWSER_LINK_COOKIE_NAME)
  ) {
    allowedMethods.push(AuthenticationMethod.PASSWORD_BROWSER_LINK);
  }

  // Phone OTP

  if (filteredMethods.includes(AuthenticationMethod.PHONE_OTP)) {
    allowedMethods.push(AuthenticationMethod.PHONE_OTP);
  }

  // Remote Device Challenge - QR code

  if (filteredMethods.includes(AuthenticationMethod.RDC_QR_CODE)) {
    allowedMethods.push(AuthenticationMethod.RDC_QR_CODE);
  }

  // Sessions

  const sessionAcceptWithCode = filteredMethods.includes(
    AuthenticationMethod.SESSION_ACCEPT_WITH_CODE,
  );

  const sessionOtp = filteredMethods.includes(AuthenticationMethod.SESSION_OTP);

  if (sessionAcceptWithCode || sessionOtp) {
    if (sessionAcceptWithCode && sessions.length) {
      allowedMethods.push(AuthenticationMethod.SESSION_ACCEPT_WITH_CODE);
    }

    if (sessionOtp && sessions.length) {
      allowedMethods.push(AuthenticationMethod.SESSION_OTP);
    }
  }

  // Time Based OTP

  if (filteredMethods.includes(AuthenticationMethod.TIME_BASED_OTP) && account?.totp) {
    allowedMethods.push(AuthenticationMethod.TIME_BASED_OTP);
  }

  // WebAuthN

  if (filteredMethods.includes(AuthenticationMethod.WEBAUTHN)) {
    allowedMethods.push(AuthenticationMethod.WEBAUTHN);
  }

  return allowedMethods;
};
