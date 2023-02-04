import { ReverseMap } from "../utility";

export const AuthenticationMethods = {
  BANK_ID_SE: "bank_id_se",
  DEVICE_LINK: "device_link",
  EMAIL: "email",
  MFA_COOKIE: "mfa_cookie",
  PASSWORD: "password",
  PHONE: "phone",
  SESSION_LINK: "session_link",
  TIME_BASED_OTP: "totp",
  WEBAUTHN: "webauthn",
} as const;

export type AuthenticationMethod = ReverseMap<typeof AuthenticationMethods>;
