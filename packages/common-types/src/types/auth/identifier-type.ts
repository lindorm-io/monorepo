import { ReverseMap } from "../utility";

export const IdentifierTypeEnum = {
  EMAIL: "email",
  EXTERNAL: "external",
  NIN: "nin",
  PHONE: "phone",
  SSN: "ssn",
  USERNAME: "username",
} as const;

export type IdentifierType = ReverseMap<typeof IdentifierTypeEnum>;
