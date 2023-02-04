import { ReverseMap } from "../utility";

export const DeviceTokenTypeEnum = {
  CHALLENGE_CONFIRMATION_TOKEN: "challenge_confirmation_token",
  CHALLENGE_SESSION_TOKEN: "challenge_session_token",
  ENROLMENT_SESSION_TOKEN: "enrolment_session_token",
  REMOTE_DEVICE_CHALLENGE_SESSION_TOKEN: "remote_device_challenge_session_token",
} as const;

export type DeviceTokenType = ReverseMap<typeof DeviceTokenTypeEnum>;
