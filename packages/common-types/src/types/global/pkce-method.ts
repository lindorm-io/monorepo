import { ReverseMap } from "../utility";

export const PKCEMethods = {
  PLAIN: "plain",
  SHA256: "S256",
} as const;

export type PKCEMethod = ReverseMap<typeof PKCEMethods>;
