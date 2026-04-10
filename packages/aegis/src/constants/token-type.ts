export const KNOWN_TOKEN_TYPES = [
  "access_token",
  "refresh_token",
  "id_token",
  "logout_token",
  "security_event",
  "dpop",
] as const;

type KnownTokenType = (typeof KNOWN_TOKEN_TYPES)[number];

export type TokenType = KnownTokenType | (string & {});

export const TOKEN_TYPE_TO_SHORT_NAME: Record<KnownTokenType, string> = {
  access_token: "at",
  refresh_token: "rt",
  id_token: "JWT",
  logout_token: "logout",
  security_event: "secevent",
  dpop: "dpop",
};
