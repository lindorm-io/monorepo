import { ReverseMap } from "../utility";

export const RdcSessionTypes = {
  CALLBACK: "callback",
  ENROLMENT: "enrolment",
} as const;

export type RdcSessionType = ReverseMap<typeof RdcSessionTypes>;
