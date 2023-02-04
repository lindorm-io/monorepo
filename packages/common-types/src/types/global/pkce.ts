import { ReverseMap } from "../utility";

export const PkceEnum = {
  PLAIN: "plain",
  SHA256: "S256",
} as const;

export type PKCE = ReverseMap<typeof PkceEnum>;
