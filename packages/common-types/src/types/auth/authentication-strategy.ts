import { ReverseMap } from "../utility";

export const AuthenticationStrategies = {
  BANK_ID_SE: "bank_id_se",
  DEVICE_CHALLENGE: "device_challenge",
  EMAIL_LINK: "email_link",
  EMAIL_OTP: "email_otp",
  MFA_COOKIE: "mfa_cookie",
  PASSWORD: "password",
  PASSWORD_BROWSER_LINK: "password_browser_link",
  PHONE_OTP: "phone_otp",
  RDC_PUSH_NOTIFICATION: "rdc_push_notification",
  RDC_QR_CODE: "rdc_qr_code",
  SESSION_ACCEPT_WITH_CODE: "session_accept_with_code",
  SESSION_OTP: "session_otp",
  TIME_BASED_OTP: "time_based_otp",
  WEBAUTHN: "webauthn",
} as const;

export type AuthenticationStrategy = ReverseMap<typeof AuthenticationStrategies>;
