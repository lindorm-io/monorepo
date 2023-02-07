import { ReverseMap } from "../utility";

export const DeviceTokenTypes = {
  CHALLENGE_CONFIRMATION: "challenge_confirmation_token",
  CHALLENGE_SESSION: "challenge_session_token",
  ENROLMENT_SESSION: "enrolment_session_token",
  REMOTE_DEVICE_CHALLENGE_SESSION: "remote_device_challenge_session_token",
} as const;

export type DeviceTokenType = ReverseMap<typeof DeviceTokenTypes>;
