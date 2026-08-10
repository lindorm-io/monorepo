/**
 * Which aegis token profile the STRUCTURED arm of an access-token mount verifies
 * against — the floor a locally-verifiable credential must clear before any
 * claim matcher runs. Defaults to `"access_token"`.
 *
 * - `"access_token"` — RFC 9068 strict, and the only correct answer for a
 *   service verifying tokens its own authorization server issued. It demands
 *   `typ: application/at+jwt` (§2.2), exactly ONE resource `aud`, and
 *   `client_id`; the expected `iss` is the deployment's own.
 * - `"external_access_token"` — the interop sibling, for a resource server
 *   accepting tokens a THIRD-PARTY authorization server issued. It mandates no
 *   `typ` (RFC 7515 §4.1.9 makes it optional and `application/at+jwt` is far
 *   from universal), does not require `client_id`, allows any number of
 *   audiences, and takes the expected `iss` PER TOKEN — the deployment's own
 *   issuer is never assumed for a third party's token. Pylon supplies it from
 *   the resolved auth issuer either way, so a mount on this profile is a
 *   deployment whose `auth.driver` names the third party.
 *
 * `access_token` is not loosened to cover both because aegis enforces a
 * profile's `required` list at MINT as well as at verify: admitting another
 * issuer's token would also permit this deployment to ISSUE a degraded one. The
 * mount picks which floor applies instead.
 *
 * Both require `iss`/`sub`/`aud`/`iat`/`jti`/`exp` present, both require a
 * URI-shaped `iss` (RFC 7519 §4.1.1), both require `aud` to contain the mount's
 * own `audience`, and both are asymmetric-signature only.
 *
 * ⚠ Only the LENIENT profile forbids `nonce`/`at_hash`/`c_hash`/`s_hash`, and
 * that list is its ID-TOKEN DEFENCE rather than decoration. With no `typ`
 * mandated there is no structural discriminator left — `typ: JWT` is exactly
 * what an id_token carries — so the four claims an access token never has are
 * what keeps an id_token out. The strict profile needs no such list: its
 * `application/at+jwt` floor already refuses an id_token outright. The second
 * defence, on both, is the mount's REQUIRED `audience`: an id_token's `aud` is
 * the CLIENT, not the resource server.
 *
 * ⚠ CLOSED on purpose — two names, no widening. `KnownProfile | (string & {})`
 * would let a typo typecheck, and `keyof BuiltInProfiles` would make `id_token`
 * selectable on a bearer mount, which is precisely the credential confusion the
 * strict profile exists to prevent. A deployment that registers a profile of its
 * own is stating a NEW floor, and this union is where that decision is made.
 */
export type AccessTokenProfile = "access_token" | "external_access_token";
