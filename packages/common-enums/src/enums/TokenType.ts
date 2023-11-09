export enum TokenType {
  // OpenID Standard Token Type
  ACCESS = "access_token",
  ID = "id_token",
  LOGOUT = "logout_token",
  REFRESH = "refresh_token",

  // Authentication Service
  AUTHENTICATION_CONFIRMATION = "authentication_confirmation_token",
  STRATEGY = "strategy_token",

  // Device Service
  CHALLENGE_CONFIRMATION = "challenge_confirmation_token",
  CHALLENGE = "challenge_token",
  ENROLMENT = "enrolment_token",
  REMOTE_DEVICE_CHALLENGE = "remote_device_challenge_token",
}
