import { ReverseMap } from "../utility";

export const SubjectHintEnum = {
  CLIENT: "client",
  IDENTITY: "identity",
  SESSION: "session",
} as const;

export type SubjectHint = ReverseMap<typeof SubjectHintEnum>;
