import { ReverseMap } from "../utility";

export const SubjectHints = {
  CLIENT: "client",
  IDENTITY: "identity",
  SESSION: "session",
} as const;

export type SubjectHint = ReverseMap<typeof SubjectHints>;
