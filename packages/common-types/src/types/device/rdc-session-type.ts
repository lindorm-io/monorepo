import { ReverseMap } from "../utility";

export const RdcSessionTypeEnum = {
  CALLBACK: "callback",
  ENROLMENT: "enrolment",
} as const;

export type RdcSessionType = ReverseMap<typeof RdcSessionTypeEnum>;
