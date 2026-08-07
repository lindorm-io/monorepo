import { ShaKit } from "@lindorm/sha";

/**
 * Which question the entry answers. It is part of the digest so the two caches
 * can never be confused for one another, whatever storage they end up sharing —
 * the payloads differ, and an id that names its own concern cannot be misread.
 */
export type AuthCacheKind = "introspection" | "userinfo";

type Options = {
  kind: AuthCacheKind;
  token: string;
  issuer: string;
  clientId: string;
};

/**
 * A driver-response cache key — a SHA-256 digest, never the raw token: the entry
 * lands in shared (often multi-tenant) storage, and a key IS readable there.
 *
 * ⚠ Keyed on the TOKEN, never the subject. Two tokens for one subject can carry
 * different scopes, and BOTH cached answers vary by granted scope: RFC 7662 §2.2
 * lets the authorization server "limit which scopes from a given token are
 * returned for each protected resource", and OIDC Core §5.3 returns exactly the
 * profile claims the token's scopes authorise.
 *
 * `issuer` and `clientId` are part of the digest for the same reason: RFC 7662
 * §2.2 also says "the authorization server MAY respond differently to different
 * protected resources making the same request". Keying on the token alone would
 * let two pylons sharing a KV namespace serve each other answers the provider
 * deliberately made different — leaking claims one of them was never meant to
 * see.
 *
 * ⚠ Both come from the DRIVER — `endpoints().issuer` and the driver's own client
 * id — not from a relying-party config. RFC 7662 §2.1 has the RESOURCE SERVER
 * authenticate to the introspection endpoint, and those are the credentials the
 * answer varies by.
 */
export const buildAuthCacheKey = ({ kind, token, issuer, clientId }: Options): string =>
  ShaKit.S256([kind, issuer, clientId, token].join("\n"));
