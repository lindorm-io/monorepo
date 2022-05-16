import { Account, LoginSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { FlowType } from "../../enum";
import { includes } from "lodash";
import { BROWSER_LINK_COOKIE_NAME, FLOW_TYPE_CONFIG, MFA_COOKIE_NAME } from "../../constant";

export const calculateAllowedFlows = (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  account?: Account,
): Array<FlowType> => {
  const filteredFlows: Array<FlowType> = [];

  for (const config of FLOW_TYPE_CONFIG) {
    if (includes(loginSession.amrValues, config.name)) continue;
    if (loginSession.amrValues.length < config.amrValuesMin) continue;
    if (loginSession.amrValues.length > config.amrValuesMax) continue;
    if (loginSession.levelOfAssurance >= config.valueMax) continue;

    filteredFlows.push(config.name);
  }

  const allowedFlows: Array<FlowType> = [];

  // Bank ID SE

  if (includes(filteredFlows, FlowType.BANK_ID_SE) && loginSession.country === "se") {
    allowedFlows.push(FlowType.BANK_ID_SE);
  }

  // Device Link Challenge

  if (includes(filteredFlows, FlowType.DEVICE_CHALLENGE) && loginSession.deviceLinks.length) {
    allowedFlows.push(FlowType.DEVICE_CHALLENGE);
  }

  // Email

  if (
    includes(filteredFlows, FlowType.EMAIL_LINK) &&
    !includes(loginSession.amrValues, FlowType.EMAIL_OTP)
  ) {
    allowedFlows.push(FlowType.EMAIL_LINK);
  }

  if (
    includes(filteredFlows, FlowType.EMAIL_OTP) &&
    !includes(loginSession.amrValues, FlowType.EMAIL_LINK)
  ) {
    allowedFlows.push(FlowType.EMAIL_OTP);
  }

  // MFA Cookies

  if (includes(filteredFlows, FlowType.MFA_COOKIE) && ctx.getCookie(MFA_COOKIE_NAME)) {
    allowedFlows.push(FlowType.MFA_COOKIE);
  }

  // Password

  if (includes(filteredFlows, FlowType.PASSWORD)) {
    allowedFlows.push(FlowType.PASSWORD);
  }

  if (
    includes(filteredFlows, FlowType.PASSWORD_BROWSER_LINK) &&
    ctx.getCookie(BROWSER_LINK_COOKIE_NAME)
  ) {
    allowedFlows.push(FlowType.PASSWORD_BROWSER_LINK);
  }

  // Phone OTP

  if (includes(filteredFlows, FlowType.PHONE_OTP)) {
    allowedFlows.push(FlowType.PHONE_OTP);
  }

  // Remote Device Challenge - QR code

  if (includes(filteredFlows, FlowType.RDC_QR_CODE)) {
    allowedFlows.push(FlowType.RDC_QR_CODE);
  }

  // Sessions

  const sessionAcceptWithCode = includes(filteredFlows, FlowType.SESSION_ACCEPT_WITH_CODE);

  const sessionOtp = includes(filteredFlows, FlowType.SESSION_OTP);

  if (sessionAcceptWithCode || sessionOtp) {
    if (sessionAcceptWithCode && loginSession.sessions.length) {
      allowedFlows.push(FlowType.SESSION_ACCEPT_WITH_CODE);
    }

    if (sessionOtp && loginSession.sessions.length) {
      allowedFlows.push(FlowType.SESSION_OTP);
    }
  }

  // Time Based OTP

  if (includes(filteredFlows, FlowType.TIME_BASED_OTP) && account?.totp) {
    allowedFlows.push(FlowType.TIME_BASED_OTP);
  }

  // WebAuthN

  if (includes(filteredFlows, FlowType.WEBAUTHN)) {
    allowedFlows.push(FlowType.WEBAUTHN);
  }

  return allowedFlows;
};
