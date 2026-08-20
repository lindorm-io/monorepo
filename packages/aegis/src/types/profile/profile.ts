import type { Expiry } from "@lindorm/date";
import type { KryptosAlgClass } from "@lindorm/kryptos";
import type { TokenType } from "../../constants/token-type.js";
import type { PolicyRule, SignContext } from "./policy.js";
import type { ClaimsTokenFormat } from "../domain/token-format.js";
import type { AegisEncKey, AegisSignKey } from "../keys/key-selectors.js";
import type { DomainTokenEnvelope } from "../domain/domain-envelope.js";
import type { CweEncryptOptions, JweEncryptOptions } from "../kit/encrypted.js";
import type { SignTokenOptions } from "../domain/sign.js";
import type { VerifyOptions } from "../domain/verify.js";

/**
 * The envelope claims a profile may auto-generate at mint — the four
 * mint-GENERATABLE claims, by DOMAIN name. The mint pipeline maps each to its
 * wire claim through the ONE translator, so no wire name reaches a profile
 * descriptor.
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
   * The envelope claims mint auto-generates, by DOMAIN name — see
   * {@link AutoInjectableClaim}. Membership is checked with `.includes(...)`.
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
 * The sign-then-encrypt wrapper's own envelope, as the PROFILED MINT door takes
 * it — both wire families' encrypt options, because the PROFILE decides which
 * wire the outer is emitted on and the caller cannot know it here.
 *
 * ⛔ MINUS `custom`, and the `Omit` is the tier rule made structural. `aegis.mint`
 * is a DOMAIN verb: a caller reaches it without learning either wire's
 * vocabulary, and an UNREGISTERED header parameter has no domain name by
 * definition. Leaving `custom` reachable here was worse than merely off-tier —
 * `mint-token.ts` forwards a NAMED subset of this envelope to `encryptOuter`, so
 * the bag typechecked and was then silently dropped, which is precisely the
 * accepted-and-ignored outcome the wire disposition tables exist to prevent.
 * Custom parameters are a KIT-tier capability: `aegis.jwe.encrypt` /
 * `aegis.cwe.encrypt` take them. Pinned in `types/header/wire-envelope.test.ts`.
 */
export type MintEncryptOptions = Omit<JweEncryptOptions & CweEncryptOptions, "custom"> & {
  key?: AegisEncKey;
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
  encrypt?: MintEncryptOptions;
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
   * ⚠ THE DEFAULT IS `false`. `mint` forwards this value untouched
   * (`internal/utils/mint-token.ts`) and every reader floors an omitted flag to
   * the interoperable answer — that flooring IS the interop guarantee.
   */
  proprietary?: boolean;
};

/**
 * Options for profiled verify. Beyond the standard verify knobs, the floor
 * needs the verifier's own identity (`audience`) to assert the token's
 * `aud` contains self. `issuer` may override the configured/profile issuer
 * source (per-token profiles). Declarative claim matching beyond the floor is
 * the separate positional `assert`
 * ({@link import("../domain/domain-assert.js").VerifyAssert}) argument.
 */
export type ProfileVerifyOptions = VerifyOptions & {
  audience: string;
  issuer?: string;
  // ⛔ No `clockTolerance` — it is a standard verify knob, declared ONCE on
  // {@link VerifyOptions}. Re-declared here the profiled path destructures it
  // away as a profile-only field and drops it.
  // No `format` — unlike mint, verify is NOT told the wire encoding. It detects
  // COSE vs JOSE from the token itself (`Aegis.isCose`), so a caller never has to
  // know, or match, a token's format to verify it.
};

/**
 * The input to `aegis.sign` — the DOMAIN sign verb, and the profile-less twin of
 * `aegis.mint`.
 *
 * CLAIMS ONLY: `jwt` / `cwt` / `cwm`, defaulting to `"jwt"`, exactly as
 * `ProfileMintOptions.format` does. A caller wanting an opaque signature reaches
 * `aegis.jws.sign()` / `aegis.cws.sign()`, the wire-level namespaces.
 *
 * What `sign` does that the kit namespaces do not: it takes DOMAIN input. The
 * payload is a domain claim set, translated to the target wire's own spelling on
 * the way out (`subject` → `sub` on JOSE, → label `2` on COSE, RFC 8392 §3.1.2),
 * and `tokenType`/`header` are domain-named and translated too.
 *
 * What `mint` does that this does not is exactly the profile floor: no policy is
 * enforced, no envelope claim is generated, no `exp` is derived from a lifetime,
 * no `iss` is filled in from the deployment, no algorithm class is required of
 * the key, no profile typ is mandated, and no sensitive claim forces an
 * encrypting outer.
 */
export type RawSignInput = DomainTokenEnvelope<AegisSignKey> & {
  /** The claims format to emit. Defaults to `"jwt"`, mirroring `ProfileMintOptions`. */
  format?: ClaimsTokenFormat;
  /**
   * The DOMAIN claim set. Not a wire literal — the registry re-keys every claim
   * it knows.
   *
   * ⚠ `Record<string, unknown>`, NOT `Dict`. `Dict` is `Record<string, any>`,
   * which every object type is assignable to — `Buffer` included — so the verb
   * could be handed bytes and the translator would walk their numeric indices
   * into claims `0`, `1`, `2`… A `Buffer` is unassignable here (no index
   * signature), while a `Dict` still is.
   */
  payload: Record<string, unknown>;
  /**
   * The DOMAIN token type. Reduced to the bare prefix each kit re-wraps in its
   * own format (`access_token` → `application/at+jwt` / `application/at+cwt`).
   */
  tokenType?: TokenType;
  /**
   * An explicit type header, OVERRIDING the `tokenType`-derived value. Stated in
   * the JOSE spelling (`at+jwt`, `application/at+jwt`, or the bare `JWT`) on
   * either wire — the kit re-wraps the prefix, so a COSE write of `at+jwt` emits
   * `application/at+cwt`.
   *
   * ⚠ No `null` member, unlike `SignTokenOptions.typ`. `null` exists there to
   * countermand a PROFILE's mandated type, and there is no profile here; omitting
   * the option is how a caller states nothing.
   */
  typ?: string;
  /**
   * Emit lindorm private-use COSE labels — compact integer claim labels and the
   * integer form of private-use HEADER parameters (`objectId`). Default `false`,
   * the interoperable spelling. COSE only; the JOSE kits ignore it.
   */
  proprietary?: boolean;
};
