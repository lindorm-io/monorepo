import { ReverseMap } from "../utility";

export const RdcSessionModeEnum = {
  PUSH_NOTIFICATION: "push_notification",
  QR_CODE: "qr_code",
} as const;

export type RdcSessionMode = ReverseMap<typeof RdcSessionModeEnum>;
