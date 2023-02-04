import { ReverseMap } from "../utility";

export const PKCEs = {
  PLAIN: "plain",
  SHA256: "S256",
} as const;

export type PKCE = ReverseMap<typeof PKCEs>;
