import { ReverseMap } from "../utility";

export const SessionStatusEnum = {
  ACKNOWLEDGED: "acknowledged",
  CODE: "code",
  CONFIRMED: "confirmed",
  EXPIRED: "expired",
  PENDING: "pending",
  REJECTED: "rejected",
  SKIP: "skip",
  VERIFIED: "verified",
} as const;

export type SessionStatus = ReverseMap<typeof SessionStatusEnum>;
