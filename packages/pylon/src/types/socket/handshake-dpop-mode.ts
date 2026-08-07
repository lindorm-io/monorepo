/**
 * How strictly a socket HANDSHAKE treats DPoP (RFC 9449).
 *
 * - `"optional"` (default) — a `cnf.jkt`-bound token must present a valid proof;
 *   an unbound one is accepted as a plain bearer.
 * - `"required"` — the credential must be bound AND proved.
 * - `"disabled"` — a bound token is accepted as a plain bearer, proof ignored.
 */
export type HandshakeDpopMode = "required" | "optional" | "disabled";
