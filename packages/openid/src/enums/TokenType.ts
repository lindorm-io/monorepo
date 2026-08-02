/**
 * RFC 6749 §7.1 access token types — the `token_type` member of a token
 * response. A CLOSED set: exactly the two types registered in the IANA OAuth
 * Access Token Types registry (RFC 6749 §11.1) that lindorm issues today.
 *
 * NAME — `TokenType`, not `TokenType`. RFC 6749 §7.1 is titled "Access
 * Token Types", and `@lindorm/aegis` already owns a `TokenType` meaning the
 * token KIND (`access_token` / `refresh_token` / `id_token` / …). The two are
 * different concepts; the precise name keeps them apart.
 *
 * CASING — the values are the casing each defining spec registers and shows on
 * the wire. RFC 6749 §5.1 says the `token_type` VALUE is case insensitive, so a
 * remote AS may legitimately answer `bearer`; a reader that must accept that
 * normalises before comparing (or widens, per the package rule). This set is
 * the canonical spelling a provider EMITS.
 */
export const TokenType = {
  /** wire: `Bearer` — RFC 6750 §6.1.1 registers the type name; §4 shows the value */
  Bearer: "Bearer",
  /** wire: `DPoP` — RFC 9449 §12.1 registers the type name; §5 shows the value */
  DPoP: "DPoP",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];
