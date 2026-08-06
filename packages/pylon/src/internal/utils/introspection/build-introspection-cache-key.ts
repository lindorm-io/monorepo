import { ShaKit } from "@lindorm/sha";

type Options = {
  token: string;
  issuer: string;
  clientId: string;
};

/**
 * The introspection cache key — a SHA-256 digest, never the raw token: the entry
 * lands in shared (often multi-tenant) storage, and a key IS readable there.
 *
 * `issuer` and `clientId` are part of the digest because the introspection
 * RESPONSE is a function of all three. RFC 7662 §2.2: "The authorization server
 * MAY respond differently to different protected resources making the same
 * request... MAY limit which scopes from a given token are returned for each
 * protected resource." Keying on the token alone would let two pylons sharing a
 * KV namespace serve each other answers the AS deliberately made different —
 * leaking scopes one of them was never meant to see.
 *
 * ⚠ Both come from the DRIVER — `endpoints().issuer` and the driver's own client
 * id — not from a relying-party config. RFC 7662 §2.1 has the RESOURCE SERVER
 * authenticate to the introspection endpoint, and those are the credentials the
 * answer varies by.
 */
export const buildIntrospectionCacheKey = ({
  token,
  issuer,
  clientId,
}: Options): string => ShaKit.S256([issuer, clientId, token].join("\n"));
