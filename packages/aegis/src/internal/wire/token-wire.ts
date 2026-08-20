import type { IKryptos, KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type {
  AegisDecryptKey,
  AegisSignKey,
  DecryptTokenOptions,
  DomainTokenHeader,
  EncryptedToken,
  JweEncryptOptions,
  JoseSignStructuredTokenOptions,
  JoseSignUnstructuredTokenOptions,
  CoseSignStructuredTokenOptions,
  CoseSignUnstructuredTokenOptions,
  CweEncryptOptions,
  SignedToken,
  TokenContent,
  TokenFormat,
  StructuredFormat,
  TokenFormatTag,
  TokenProfile,
  TokenProfileTyp,
  VerifyOptions,
  WireTokenHeader,
} from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import type { AegisDeps } from "../utils/aegis-deps.js";
import type { InputDisposition } from "./wire-input-disposition.js";

/**
 * A claims token read off the wire — the shape BOTH wires reduce to, so
 * everything above this point is one implementation.
 */
export type ClaimsRead = {
  /** The CLAIMS format actually read: `jwt`, `cwt` (COSE_Sign1) or `cwm` (COSE_Mac0). */
  format: StructuredFormat;
  /**
   * The wire-keyed claim payload EXACTLY as the wire carried it — what
   * `VerifiedToken.wire.payload` reports for pass-through and re-emit.
   *
   * ⚠ JOSE hands back NumericDates (plain integers) and COSE hands back `Date`s,
   * because the COSE claim codec decodes them on the way out of the kit and the
   * JOSE one does not. That difference is visible to a consumer reading
   * `wire.payload`, so it is preserved rather than normalised here.
   */
  wire: Dict;
  /**
   * The same claims with every temporal claim as a `Date` — what the identity
   * matchers run against, so a temporal matcher compares like with like on both
   * wires. Identical to {@link wire} on COSE.
   */
  matcher: Dict;
  /** The INTEGRITY-PROTECTED header — the only bucket a signature or AEAD covers. */
  protectedHeader: WireTokenHeader;
  /** The UNAUTHENTICATED header bucket. `{}` on JOSE, which has no such bucket. */
  unprotectedHeader: Partial<WireTokenHeader>;
};

/** A {@link ClaimsRead} whose signature/MAC has been checked. */
export type ClaimsVerified = ClaimsRead & {
  /**
   * The algorithm the signature was ACTUALLY verified under. Every claims-bearing
   * kit refuses a header `alg` that differs from the resolved key's own, so a lie
   * there costs the signature and this is never a header parameter taken on trust.
   */
  algorithm: KryptosAlgorithm;
};

export type VerifyClaimsInput = {
  token: string;
  deps: AegisDeps;
  options: VerifyOptions;
  /**
   * The caller's `crit` declaration, ALREADY resolved to WIRE names — the kits
   * compare against a wire-named header, and `VerifyOptions.critical` is domain
   * named. Resolved once above the seam
   * (`internal/header/declared-crit-to-wire.ts`) so neither wire holds a second
   * opinion about the spelling.
   */
  crit: Array<string> | undefined;
  /** The issuer the VERIFIER expects, when it declared one — SCOPES the key lookup. */
  issuer: string | undefined;
};

export type VerifyOpaqueInput = {
  token: string;
  deps: AegisDeps;
  options: VerifyOptions;
  /** Same resolved declaration as {@link VerifyClaimsInput.crit}. */
  crit: Array<string> | undefined;
};

export type OpaqueVerified = {
  format: TokenFormatTag;
  /**
   * The opaque payload as the TYPE it was signed as — the opaque kits reconstruct
   * it from the wire cty (`reconstructContent`), so an object signed under
   * `application/json` comes back a Dict on either wire.
   *
   * ⚠ It was `Buffer | string`, which was a lie about the runtime on both wires:
   * `CwsKit.verify`/`JwsKit.verify` have always returned whatever the codec
   * reconstructed, and only this record narrowed it.
   */
  payload: TokenContent;
  protectedHeader: WireTokenHeader;
  unprotectedHeader: Partial<WireTokenHeader>;
};

/**
 * The input to securing DOMAIN claims — the aegis-only fields intersected with
 * BOTH claims-kit option types.
 *
 * ⚠ BOTH, because ONE input crosses to BOTH wires and neither is wider on its
 * own: `JoseSignStructuredTokenOptions` alone has `custom.header`,
 * `CoseSignStructuredTokenOptions` alone has `custom.protected`,
 * `custom.unprotected` and `proprietary`. Each wire's kits answer for the members
 * they do not read ({@link WireInputDispositions}). The public doors are the
 * per-wire ones — `aegis.jwt.sign` takes `JoseSignStructuredTokenOptions`, so
 * `custom.unprotected` is a compile error there rather than a value this seam has
 * to refuse.
 *
 * ⚠ The intersection is the mechanism, not a tidying. Only the aegis-only fields
 * above the `&` can be named in a wire's destructure; the whole kit surface
 * necessarily leaves by rest-spread, so a kit option cannot be dropped by a wire
 * forgetting to mention it — the failure mode being that a kit option is accepted
 * on one wire and silently ignored on the other. A new kit sign option threads
 * through both wires with no wire change, and {@link TokenWire.dispositions}
 * forces each wire to state what it does with it.
 */
export type SignClaimsInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /** The DOMAIN-keyed common claims; the wire translates them with its own selector. */
  common: Dict;
  /** COSE only — which secured structure to emit (`cwt` = Sign1, `cwm` = Mac0). */
  format: TokenFormat;
} & JoseSignStructuredTokenOptions &
  CoseSignStructuredTokenOptions;

/**
 * The input to a PROFILED write's typ derivation.
 *
 * ⚠ There is no profile-LESS member here, and that is deliberate: with no profile
 * to consult, nothing in the derivation differs between a JOSE and a COSE write,
 * so `aegis.sign` resolves its prefix ABOVE this seam through the one shared
 * `signTypPrefix` (`internal/utils/sign-typ-prefix.ts`). Only the profile makes
 * the two wires disagree, so only the profile reaches a per-wire function.
 */
export type MintTypInput = {
  profile: TokenProfile;
  /** The content's own domain `tokenType`, when it carries one. */
  contentTokenType: TokenType | undefined;
  /** The caller's explicit `SignTokenOptions.typ`. */
  signTyp: string | null | undefined;
  format: TokenFormat;
};

/**
 * The input to an OPAQUE signature — a JWS or a CWS. These serialisations have no
 * claims layer, so there are no domain claims and no `nameOf` translation: the
 * payload is the caller's own content and the wire hands it to its opaque kit
 * family verbatim.
 *
 * ⚠ `aegis.sign` does NOT reach this — it is claims-only. The opaque namespaces
 * (`aegis.jws.sign` / `aegis.cws.sign`) do, through the shared guard
 * (`raw-sign-opaque.ts`). See {@link TokenWire.signOpaque}.
 *
 * Same intersection as {@link SignClaimsInput}, over BOTH opaque kit option
 * types and for the same reason — neither is wider on its own. The opaque kits
 * secure whatever bytes they are given; the
 * registry-driven claim normalisation is applied aegis-side, to an OBJECT payload
 * only.
 */
export type SignOpaqueInput = {
  deps: AegisDeps;
  /**
   * The caller's content, as {@link TokenContent} — the SAME type the opaque kit
   * namespaces accept and the same one {@link EncryptContentInput.content} and
   * {@link OpaqueVerified.payload} already use.
   *
   * ⚠ `Buffer | string | Dict` is NARROWER than what reaches here: `number` and
   * `boolean` are members of `TokenContent` and are not assignable to that
   * triple, so a narrowed field refuses two payload types the public door
   * accepts. (`Array` passes such a triple only because `Dict` is
   * `Record<string, any>`.)
   */
  payload: TokenContent;
  key: AegisSignKey | undefined;
} & JoseSignUnstructuredTokenOptions &
  CoseSignUnstructuredTokenOptions;

/**
 * The input to sealing arbitrary content in this wire's encrypting outer — the
 * ONE write-side encryption entry, shared by `aegis.encrypt` and by the
 * sign-then-encrypt composition (`encryptOuter`, which is this operation with
 * the nested-token content and cty filled in).
 */
/**
 * Same intersection as {@link SignClaimsInput}, over BOTH encrypt option types.
 * Neither is wider on its own — `JweEncryptOptions` alone has the ECDH-ES party
 * info and `custom.header`, `CweEncryptOptions` alone has `custom.protected`,
 * `custom.unprotected` and `proprietary`; the two custom bags share no key at all
 * — so the seam carries the intersection and each wire's table states what it
 * does with every member. The party info is what makes this load-bearing: the COSE
 * wire has to REFUSE it rather than accept it silently.
 *
 * ⚠ There is no `contentType` field. A NESTED token's cty is a `header.cty` the
 * COMPOSITION stamps (`encrypt-outer.ts`), because both wires reached the same
 * place with it — the JOSE branch merged it into the header bag and the COSE one
 * handed `encryptCose` a `cty` that it merged into the header bag — so it was a
 * translation written twice below the seam instead of once above it.
 */
export type EncryptContentInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /**
   * The plaintext, EXACTLY as the caller stated it. Every value is opaque to this
   * operation — a `Dict` is serialised under its own literal keys by the kit's
   * own codec, never label-mapped or renamed, so an `{ iss: "x" }` sealed here
   * comes back `{ iss: "x" }` and never as a registered issuer claim.
   */
  content: TokenContent;
} & JweEncryptOptions &
  CweEncryptOptions;

/**
 * `DecryptTokenOptions` carries ONE member, the `crit` declaration, and both
 * wires' `decrypt` disposition tables answer for it — `forwarded` on each, since
 * the crit gate runs at the kit's own decrypt door. The intersection is what
 * makes that mandatory: a member added here does not compile until every wire's
 * table states what it does with it.
 */
export type DecryptInput = {
  token: string;
  deps: AegisDeps;
  /**
   * The per-call decryption key policy. `undefined` for the verify peel, which
   * is not a caller's decrypt — it is one step of reading a signed token.
   */
  key: AegisDecryptKey | undefined;
} & DecryptTokenOptions;

/**
 * Every wire operation's KIT OPTION surface, and what THIS wire does with each
 * option of it. Read by the ONE shared guard (`assert-wire-input.ts`) above the
 * seam; proved by the disposition probe beside it.
 */
export type WireInputDispositions = {
  readonly signClaims: InputDisposition<
    JoseSignStructuredTokenOptions & CoseSignStructuredTokenOptions
  >;
  readonly signOpaque: InputDisposition<
    JoseSignUnstructuredTokenOptions & CoseSignUnstructuredTokenOptions
  >;
  readonly encryptContent: InputDisposition<JweEncryptOptions & CweEncryptOptions>;
  readonly decrypt: InputDisposition<DecryptTokenOptions>;
};

/**
 * An encrypted token read off the wire — the shape BOTH wires reduce to, so
 * `aegis.decrypt` and the verify peel are one implementation over it.
 */
export type EncryptedRead = {
  /**
   * The encrypting outer's DOMAIN header — both wires now produce it through the
   * ONE `domainTokenHeader` translation, over both of their header buckets. The
   * COSE side used to read it with a hand-written 24-field domain literal that
   * merged the unprotected `kid` with no allowlist and hardcoded `contentType`
   * and `tokenType` to `undefined`.
   */
  header: DomainTokenHeader;
  /**
   * THE PLAINTEXT, as the reader reconstructed it from the outer's own cty.
   *
   * ⚠ ONE field, not a `claims`/`raw` pair. The pair existed because the encrypt
   * path translated a domain claim set to wire names on the way in, so the read
   * had to know which values to translate back — and each wire needed a private
   * cty to recognise its own claims door by. Encryption is CONFIDENTIALITY: the
   * value sealed is the value returned, so there is nothing left to discriminate.
   */
  payload: TokenContent;
  /** The token exactly as this wire's reader echoes it. */
  token: string;
};

/**
 * ONE token wire. The domain layer above it — mint, verify, parse, and the
 * profile floor — is a single implementation; everything that genuinely differs
 * between a JOSE compact serialisation and a COSE structure is either a VALUE on
 * this record or one of its five operations.
 *
 * That split is deliberate and was reached independently three times: a Sign1 or
 * Mac0 structure shares nothing real with a compact JWS, so parameterising BELOW
 * the kit would push wire branches into the one layer that is correct. Above it,
 * a branch is a defect waiting to be written twice — which is what happened to
 * every verb this record replaces.
 */
export type TokenWire = {
  /**
   * What this wire does with each KIT OPTION its four write/read operations are
   * handed — `forwarded`, `consumed`, or `unsupported` and therefore REFUSED.
   *
   * The rest-spread makes a drop unexpressible; this makes the residue a
   * decision. An option a wire cannot honour used to be dropped in silence, so
   * the caller believed a request had taken effect and nothing reported that it
   * had not. Declared here, the shared guard refuses it by name.
   */
  readonly dispositions: WireInputDispositions;
  /**
   * Which wire spelling claims are keyed by (`jti` vs `cti`). The ONE naming
   * difference between the two wires at the domain layer.
   */
  readonly nameOf: NameSelector;
  /**
   * `typPresence` when the caller states none.
   *
   * JOSE defaults to `"required"` as aegis POLICY, modelled on RFC 8725 §3.11 —
   * which RECOMMENDS explicit typing rather than mandating it. COSE defaults to
   * `"optional"` because RFC 9596 genuinely leaves the `typ` (label 16) optional,
   * so a conformant foreign CWT may carry none. An EXPLICIT value behaves
   * identically on both.
   */
  readonly defaultTypPresence: "required" | "optional";
  /**
   * Whether reading a claims token on this wire REQUIRES an `iss` claim.
   *
   * ⚠ PRESERVED DIVERGENCE, not a design: the JOSE read has always refused a
   * claims token with no `iss` and the COSE read has always accepted one. Making
   * them agree is a policy change with nothing behind it yet, so it is stated
   * here as one flippable value instead of living implicitly in two functions.
   */
  readonly issuerPresence: "required" | "optional";
  /** This wire's ENCRYPTING outer format. */
  readonly encryptedFormat: EncryptedToken["format"];
  /**
   * The formats this wire admits as an encrypted token's plaintext. JOSE accepts
   * a nested claims token, an opaque JWS, or another JWE; COSE accepts only a
   * secured claims token, because a COSE_Encrypt0 over an opaque CWS has never
   * been readable here and making it so would be a new capability.
   */
  readonly encryptedInner: ReadonlyArray<TokenFormatTag>;
  /**
   * The cty an encrypting outer stamps over a NESTED token, BY THE FORMAT OF THE
   * TOKEN IT SEALS. It is what makes the read side reconstruct the plaintext to
   * the inner TOKEN rather than to whatever value shape the bytes resemble.
   *
   * ⚠ A LOOKUP, not one value per wire. The two entry points that seal a token —
   * the sign-then-encrypt composition (`encrypt-outer.ts`) and `aegis.encrypt`
   * handed an already-minted token — resolve through THIS table, so one behaviour
   * serves both. A single per-wire value was right only for the composition,
   * which always wraps a claims token; `aegis.encrypt` may be handed a JWS, and
   * declaring that `JWT` would be a false statement about the plaintext.
   *
   * A format with NO entry is a format this wire has no registered media type
   * for; nothing is stamped and the kit's codec infers from the value shape. That
   * is the honest answer and it is deliberately not filled in with an invented
   * media type — see `application/claims+cwe`, which had to be deleted.
   */
  readonly nestedTokenCty: Readonly<Partial<Record<TokenFormatTag, string>>>;
  /**
   * Whether a sign-then-encrypt OUTER carries the inner's typ PREFIX.
   *
   * ⚠ PRESERVED DIVERGENCE, not a design: the mint has always handed the same
   * prefix to both wires, the COSE outer has always stamped it, and the JOSE
   * outer has always dropped it — in a hand-written destructure that simply did
   * not name the field. Making them agree moves emitted bytes, so the difference
   * is written down as ONE flippable value instead of being re-implementable by
   * hand in a second copy of the composition.
   */
  readonly nestedTokenTyp: "inner" | "none";
  /**
   * How this wire spells a profile's `typ` policy — what the verify FLOOR expects
   * the token's own type header to be.
   */
  profileTyp(typ: TokenProfileTyp): string | undefined;
  /**
   * The bare typ PREFIX a PROFILED mint stamps on this wire.
   *
   * ⚠ PRESERVED DIVERGENCE: the JOSE mint falls back to the caller's explicit
   * `typ` and then to the content's own `tokenType` when the profile mandates
   * none; the COSE mint consults the profile and nothing else, so a caller `typ`
   * for a `cwt`/`cwm` mint is dropped. Pinned as a defect by
   * `spec-dispositions.ts` (`headerType`) and `knob-probes.ts` (`typ`).
   *
   * ⚠ `aegis.sign` does NOT reach this — see {@link MintTypInput}.
   */
  mintTypPrefix(input: MintTypInput): string | undefined;
  /**
   * The FULL type header a caller's `assert.tokenType` expects on this wire.
   *
   * ⚠ Full, not the bare prefix the kits take. A type whose short name is the
   * bare conventional form — `id_token` reduces to `JWT` — has NO prefix, so
   * handing the kits a prefix left the assertion unenforced for exactly that
   * type: the kit gate is `if (options.tokenType !== undefined)`. Comparing the
   * whole media type is what makes the check total.
   */
  assertedTyp(tokenType: string): string | undefined;

  /** Decode a claims token WITHOUT a key and WITHOUT checking its signature. */
  decodeClaims(token: string): ClaimsRead;
  /** Resolve the key by the token's own `kid` and verify integrity. */
  verifyClaims(input: VerifyClaimsInput): Promise<ClaimsVerified>;
  /**
   * Verify an OPAQUE signed token (a JWS / CWS) — no claims layer, so the payload
   * comes back exactly as it was signed.
   */
  verifyOpaque(input: VerifyOpaqueInput): Promise<OpaqueVerified>;
  /** Secure the domain-keyed common claims as this wire's claims token. */
  signClaims(input: SignClaimsInput): SignedToken;
  /**
   * Secure the caller's own content as this wire's OPAQUE signed token.
   *
   * Reached by `aegis.jws.sign` / `aegis.cws.sign` through the shared entry
   * (`raw-sign-opaque.ts`), which runs `assertWireInput` over
   * {@link WireInputDispositions.signOpaque} first — so an option a wire declares
   * `unsupported` is refused at the namespace door, by declaration, and
   * `COSE_DISPOSITIONS` is the only place that fact is written down.
   *
   * ⚠ `aegis.sign` does NOT reach this; it is claims-only.
   *
   * ⚠ A separate operation from {@link signClaims}, not a mode of it. There is no
   * claims layer to translate, the option set is different, and the two reach
   * different kit families (`JwsKit`/`CwsKit` vs `JwtKit`/`CwtKit`/`CwmKit`).
   * Folding them together would put a discriminated union in the parameter and a
   * branch back in the body — the shape this record exists to remove.
   */
  signOpaque(input: SignOpaqueInput): Promise<SignedToken>;
  /**
   * Seal content in this wire's encrypting outer, returning the bare token.
   *
   * The GENERAL operation: `aegis.encrypt` reaches it with the caller's own
   * content, and the sign-then-encrypt composition reaches it through the shared
   * `encryptOuter` util, which is this call with the nested-token content and cty
   * filled in from {@link nestedTokenCty}.
   */
  encryptContent(input: EncryptContentInput): string;
  /**
   * Peel this wire's encrypting outer, reporting the outer's domain header and
   * the plaintext the outer's own cty reconstructs to.
   *
   * The GENERAL operation: `aegis.decrypt` reads the whole record, and verify's
   * peel reaches it through the shared `decryptOuter` util, which projects the
   * plaintext back to a token string with {@link encodeToken}.
   */
  decrypt(input: DecryptInput): Promise<EncryptedRead>;
  /**
   * This wire's own token STRING as the content form it seals — a compact JOSE
   * token is already a string, a COSE token is base64url over its bytes.
   */
  decodeToken(token: string): TokenContent;
  /**
   * The inverse: decrypted content back to this wire's token STRING, or
   * `undefined` when the content is not a form this wire can re-serialise (a
   * reconstructed object is not a token).
   */
  encodeToken(content: TokenContent | undefined): string | undefined;
};
