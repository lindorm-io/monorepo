import type { Expiry } from "@lindorm/date";
import type { KryptosAlgClass } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { PolicyRule, SignContext } from "./policy.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { ClaimsTokenFormat } from "../domain/token-format.js";
import type { TokenFormat } from "../domain/token-format.js";
import type { AegisEncKey, AegisSignKey } from "../keys/key-selectors.js";
import type { DomainTokenEnvelope } from "../domain/domain-envelope.js";
import type { JweEncryptOptions } from "../kit/encrypted.js";
import type { SignTokenOptions } from "../domain/sign.js";
import type { VerifyOptions } from "../domain/verify.js";

/**
 * The envelope claims a profile may auto-generate at mint. Constrained to the
 * four mint-GENERATABLE domain claims — replacing the previous
 * `{ iat; jti; nbf; iss }` object whose WIRE names leaked into the profile
 * descriptor. The mint pipeline maps each to its wire claim via the ONE
 * translator (`issuedAt`→`iat`, `tokenId`→`jti`, `notBefore`→`nbf`,
 * `issuer`→`iss`).
 */
export type AutoInjectableClaim = "issuedAt" | "tokenId" | "notBefore" | "issuer";

/**
 * The profile's JOSE `typ` header policy — a discriminated union on `presence`:
 *
 * - `"none"` — the profile mandates no typ. Mint falls back to the
 *   tokenType-derived default (bare `JWT`); verify runs no typ check.
 * - `"required"` — mint stamps `value`; verify rejects an absent or
 *   mismatching typ (explicit typing, RFC 8725 §3.11 — a RECOMMENDATION aegis
 *   applies as policy).
 *
 * Presence is a verify-side knob only: mint always stamps `value` for
 * `"required"`.
 */
export type TokenProfileTyp =
  | { presence: "none" }
  | { presence: "required"; value: string };

/**
 * The DIRECTION a profile as a WHOLE may be used in — which door it may be
 * handed to at all. It is not a policy switch: each {@link PolicyRule} declares
 * its own `on`, so which rules run is the rule's own statement.
 *
 * - `"both"` (the default) — mint and verify, the mint/verify symmetry the
 *   verification floor already documents for `required`.
 * - `"verify"` — the profile exists to check ANOTHER issuer's token
 *   (`external_access_token`). `mint` refuses it, and the compiler refuses it
 *   too: {@link import("./content.js").ProfileContentFor} resolves such a name
 *   to `never`, so the call site does not survive a typecheck either.
 * - `"mint"` — the profile only ever emits; profiled `verify` refuses it.
 */
export type TokenProfileUse = "mint" | "verify" | "both";

/**
 * Runtime descriptor that enforces a profile's policy. Types erase and are
 * bypassable, so each profile is also a runtime descriptor — a single ordered
 * list of {@link PolicyRule}s applied by the ONE enforcer (`enforcePolicy`),
 * which selects by each rule's own declared direction.
 *
 * This is the RESOLVED descriptor — what `resolveProfile` returns and what
 * every consumer reads. Authoring is {@link TokenProfileInput}, whose optional
 * fields `defineProfile` resolves; no consumer re-derives a default.
 */
export type TokenProfile<
  P extends ReadonlyArray<PolicyRule> = ReadonlyArray<PolicyRule>,
> = {
  name: string;
  use: TokenProfileUse;
  typ: TokenProfileTyp;
  /**
   * The profile's WHOLE claim policy, in evaluation order. Every rule names the
   * direction(s) it runs in, so there is one list, one enforcer, and no call
   * site that can enforce a subset of it.
   */
  policy: P;
  /**
   * The envelope claims mint auto-generates, by DOMAIN name. Membership is
   * checked with `.includes(...)` in the mint pipeline (was a per-flag object;
   * see {@link AutoInjectableClaim}).
   */
  autoInject: ReadonlyArray<AutoInjectableClaim>;
  issuer: "platform" | "per-token";
  lifetime?: Expiry | null;
  encryptable: boolean;
  /**
   * The artifact's own opinion on the class of key that may sign it. Enforced
   * on BOTH sides, because it is a claim about what a valid signature PROVES.
   *
   * At MINT it is part of the signing FLOOR, so it CONSTRAINS the key query
   * rather than merely auditing its answer — and it is enforced on an injected
   * key too. At VERIFY there is no query to constrain (the key is named by the
   * token's `kid`), so `enforceVerifyFloor` checks it against the algorithm the
   * signature was verified under and raises `algorithm_not_permitted`.
   *
   * In practice only `"asymmetric"` (access_token, external_access_token,
   * delegation). Absent means no constraint: with `alg: none` not being a
   * Kryptos algorithm, "asymmetric or HS*" is the whole algorithm space.
   */
  algClass?: KryptosAlgClass;
};

/**
 * The AUTHORING shape — what `defineProfile` and `registerProfile` take. The
 * only difference from {@link TokenProfile} is that `use` may be omitted;
 * `defineProfile` resolves it to `"both"`, which is why omitting it changes
 * nothing for the eleven built-ins or for any consumer's custom profile. Only a
 * DELIBERATE narrowing has an effect.
 */
export type TokenProfileInput<
  P extends ReadonlyArray<PolicyRule> = ReadonlyArray<PolicyRule>,
> = Omit<TokenProfile<P>, "use"> & {
  use?: TokenProfileUse;
};

export type ProfileMintOptions = {
  /**
   * The signed JWT: its envelope options (`header`, `typ`, hash claims, …) and
   * its own per-call signing key (`sign.key`).
   */
  sign?: SignTokenOptions;
  /**
   * The sign-then-encrypt wrapper: its envelope options and the recipient
   * (client) encryption key (`encrypt.key`). Pin it with
   * `{ key: { condition: { id } } }`, target a client with
   * `{ key: { condition: { ownerId: client.id } } }`, or supply one outright
   * with `{ key: { kryptos } }`. Only meaningful for an encryptable profile;
   * its presence forces encryption on.
   */
  encrypt?: JweEncryptOptions & { key?: AegisEncKey };
  /**
   * Per-call token lifetime, overriding the profile's default `lifetime`. An
   * explicit `content.expires` (an absolute instant) still wins over this; with
   * neither set the profile default applies, and a `null` profile default with
   * no override yields no `exp`.
   */
  lifetime?: Expiry;
  context?: SignContext;
  /**
   * Per-call wire encoder. Defaults to `"jwt"` (a signed JWT); `"cwt"` mints the
   * COSE counterpart — a signed CWT (COSE_Sign1), `"cwm"` its symmetric COSE_Mac0
   * twin — optionally wrapped in a COSE_Encrypt0. Applies to the whole pipeline.
   *
   * The opaque formats are deliberately not offered: a profile is a statement
   * about claims, and an opaque signature carries none.
   */
  format?: ClaimsTokenFormat;
  /**
   * Use compact private-use integer COSE labels (default `false`): set `true`
   * for on-platform tokens, where claims with a private-use label, the
   * structured `act`/`subjectId` and private-use HEADER parameters (`oid`) are
   * keyed by their compact integer form. The default is the interoperable
   * spelling — every one of those is emitted under its string key instead
   * (never dropped), and `act`/`subjectId` become string-keyed objects. (COSE
   * only.)
   *
   * ⚠ The default is `false`, not `true`: `mint` forwards this value untouched
   * (`internal/utils/mint-token.ts`) and every reader of it floors an omitted
   * flag to the interoperable answer, which is the interop guarantee itself. The
   * `true` this said was a leftover from before that guarantee and described no
   * code path.
   */
  proprietary?: boolean;
  /**
   * How empty claims are pruned before the token is emitted, threaded into both
   * the JOSE and COSE wires so a single `mint` call controls both identically.
   * `"empty"` (default) drops null/empty-string/empty-array/empty-object
   * recursively; `"undefined"` drops only undefined.
   */
  omit?: OmitMode;
};

/**
 * Options for profiled verify. Beyond the standard verify knobs, the floor
 * (§4.4) needs the verifier's own identity (`audience`) to assert the token's
 * `aud` contains self. `issuer` may override the configured/profile issuer
 * source (per-token profiles). Declarative claim matching beyond the floor is
 * the separate positional `assert`
 * ({@link import("../domain/domain-assert.js").VerifyAssert}) argument.
 */
export type ProfileVerifyOptions = VerifyOptions & {
  audience: string;
  issuer?: string;
  // No `clockTolerance` — it is a standard verify knob and is declared ONCE, on
  // {@link VerifyOptions}. Re-declaring it here is what let the profiled path
  // destructure it away as a profile-only field and drop it.
  // No `format` — unlike mint, verify is NOT told the wire encoding. It detects
  // COSE vs JOSE from the token itself (`Aegis.isCose`), so a caller never has to
  // know, or match, a token's format to verify it.
};

/**
 * Raw / wire tier input. `payload` is a wire-literal. `aegis.sign` accepts a
 * plain object too and JSON-stringifies it before delegating to the JWS path.
 */
export type RawSignInput = DomainTokenEnvelope<AegisSignKey> & {
  /**
   * Wire encoding. `"jws"`/`"jwt"` (default) signs a JWS — the payload passes through as
   * bytes. `"cws"` signs a secured CWT (COSE_Sign1) over the CBOR-encoded payload, which
   * MUST then be a plain object; the token is base64url CBOR with no JOSE dot structure, so
   * it cannot be mistaken for — or parsed as — a JWT. `verify` auto-detects either format.
   * The `cws` namespace is the ergonomic surface over `sign({ format: "cws" })`.
   */
  format?: TokenFormat;
  payload: Buffer | string | Dict;
  tokenType?: TokenType;
};
