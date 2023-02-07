import { ReverseMap } from "../utility";

export const AuthenticationModes = {
  ELEVATE: "elevate",
  NONE: "none",
  OAUTH: "oauth",
} as const;

export type AuthenticationMode = ReverseMap<typeof AuthenticationModes>;
