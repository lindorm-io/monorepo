import type { IKryptos, KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
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
  TokenProfileTyp,
  VerifyOptions,
  WireTokenHeader,
} from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import type { AegisDeps } from "../utils/aegis-deps.js";
import type { InputDisposition } from "./wire-input-disposition.js";

/** A claims token read off the wire — the shape BOTH wires reduce to. */
export type ClaimsRead = {
  /** The CLAIMS format actually read: `jwt`, `cwt` (COSE_Sign1) or `cwm` (COSE_Mac0). */
  format: StructuredFormat;
  /**
   * The wire-keyed claim payload EXACTLY as the wire carried it — what
   * `VerifiedToken.wire.payload` reports for pass-through and re-emit.
   *
   * ⚠ JOSE hands back NumericDates and COSE hands back `Date`s, because the COSE
   * claim codec decodes them on the way out of the kit. That difference is visible
   * to a consumer, so it is preserved rather than normalised here.
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
   * kit refuses a header `alg` that differs from the resolved key's own, so this is
   * never a header parameter taken on trust.
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
   * The opaque payload as the TYPE it was signed as — the opaque kits reconstruct it
   * from the wire cty (`reconstructContent`), so an object signed under
   * `application/json` comes back a Dict on either wire. ⚠ NOT `Buffer | string`:
   * `CwsKit.verify`/`JwsKit.verify` return whatever the codec reconstructed.
   */
  payload: TokenContent;
  protectedHeader: WireTokenHeader;
  unprotectedHeader: Partial<WireTokenHeader>;
};

/**
 * The input to securing DOMAIN claims — the aegis-only fields intersected with BOTH
 * claims-kit option types, because ONE input crosses to BOTH wires and neither is
 * wider on its own. The public doors stay per-wire, so `custom.unprotected` on
 * `aegis.jwt.sign` is a compile error rather than a value this seam must refuse.
 *
 * ⚠ THE INTERSECTION IS THE MECHANISM. Only the aegis-only fields above the `&`
 * can be named in a wire's destructure, so the whole kit surface leaves by
 * rest-spread and a wire cannot drop an option by forgetting to mention it.
 * {@link TokenWire.dispositions} then forces each wire to state what it does.
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
 * The input to an OPAQUE signature — a JWS or a CWS. No claims layer, so no domain
 * claims and no `nameOf` translation: the wire hands the caller's content to its
 * opaque kit family verbatim.
 *
 * ⚠ `aegis.sign` does NOT reach this — it is claims-only. The opaque namespaces
 * (`aegis.jws.sign` / `aegis.cws.sign`) do, through the shared guard
 * (`raw-sign-opaque.ts`). Same intersection as {@link SignClaimsInput}.
 */
export type SignOpaqueInput = {
  deps: AegisDeps;
  /**
   * The caller's content, as {@link TokenContent} — the SAME type the opaque kit
   * namespaces accept.
   *
   * ⚠ `Buffer | string | Dict` is NARROWER than what reaches here: `number` and
   * `boolean` are members of `TokenContent` and are not assignable to that triple,
   * so a narrowed field would refuse two payload types the public door accepts.
   */
  payload: TokenContent;
  key: AegisSignKey | undefined;
} & JoseSignUnstructuredTokenOptions &
  CoseSignUnstructuredTokenOptions;

/**
 * The input to sealing arbitrary content in this wire's encrypting outer — the ONE
 * write-side encryption entry, shared by `aegis.encrypt` and by the
 * sign-then-encrypt composition (`encryptOuter`).
 *
 * Same intersection as {@link SignClaimsInput}, over BOTH encrypt option types. The
 * ECDH-ES party info is what makes it load-bearing: the COSE wire has to REFUSE it
 * rather than accept it silently.
 *
 * ⚠ No `contentType` field — a NESTED token's cty is a `header.cty` the COMPOSITION
 * stamps (`encrypt-outer.ts`), once above the seam rather than in each wire.
 */
export type EncryptContentInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /**
   * The plaintext, EXACTLY as the caller stated it. A `Dict` is serialised under its
   * own literal keys by the kit's codec, never label-mapped, so an `{ iss: "x" }`
   * sealed here comes back `{ iss: "x" }` and never as a registered issuer claim.
   */
  content: TokenContent;
} & JweEncryptOptions &
  CweEncryptOptions;

/**
 * Both wires' `decrypt` disposition tables answer for every member of
 * `DecryptTokenOptions`, so a member added here does not compile until each wire's
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
 * option of it. Read by the shared guard (`assert-wire-input.ts`) above the seam;
 * proved by `wire-input-disposition.test.ts`.
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
   * The encrypting outer's DOMAIN header — both wires produce it through the ONE
   * `domainTokenHeader` translation, over both of their header buckets.
   */
  header: DomainTokenHeader;
  /**
   * THE PLAINTEXT, as the reader reconstructed it from the outer's own cty.
   *
   * ⚠ ONE field, not a `claims`/`raw` pair. Encryption is CONFIDENTIALITY: the value
   * sealed is the value returned, so there is nothing to discriminate.
   */
  payload: TokenContent;
  /** The token exactly as this wire's reader echoes it. */
  token: string;
};

/**
 * ONE token wire. The domain layer above it — mint, verify, parse and the profile
 * floor — is a single implementation; everything that genuinely differs between a
 * JOSE compact serialisation and a COSE structure is either a VALUE on this record
 * or one of its operations. Parameterising BELOW the kit would instead push wire
 * branches into the layer that is already correct.
 */
export type TokenWire = {
  /**
   * What this wire does with each KIT OPTION its write/read operations are handed —
   * `forwarded`, `consumed`, or `unsupported` and therefore REFUSED. The
   * rest-spread makes a drop unexpressible; this makes the residue a decision the
   * shared guard can refuse by name.
   */
  readonly dispositions: WireInputDispositions;
  /**
   * Which wire spelling claims are keyed by (`jti` vs `cti`). The ONE naming
   * difference between the two wires at the domain layer.
   */
  readonly nameOf: NameSelector;
  /**
   * `typPresence` when the caller states none. JOSE defaults to `"required"` as
   * aegis POLICY (RFC 8725 §3.11); COSE defaults to `"optional"` (RFC 9596 §2). An
   * EXPLICIT value behaves identically on both.
   */
  readonly defaultTypPresence: "required" | "optional";
  /**
   * Whether reading a claims token on this wire REQUIRES an `iss` claim.
   *
   * ⚠ THE TWO WIRES DIVERGE: JOSE refuses a claims token with no `iss`, COSE accepts
   * one. Making them agree is a policy change, so the difference is one flippable
   * value here rather than implicit in two functions.
   */
  readonly issuerPresence: "required" | "optional";
  /** This wire's ENCRYPTING outer format. */
  readonly encryptedFormat: EncryptedToken["format"];
  /**
   * The formats this wire admits as an encrypted token's plaintext. JOSE accepts a
   * nested claims token, an opaque JWS, or another JWE; COSE accepts only a secured
   * claims token — its claims decoder refuses the `+cws` media type.
   */
  readonly encryptedInner: ReadonlyArray<TokenFormatTag>;
  /**
   * The cty an encrypting outer stamps over a NESTED token, BY THE FORMAT OF THE
   * TOKEN IT SEALS, so the read side reconstructs the plaintext to the inner TOKEN
   * rather than to whatever value shape the bytes resemble.
   *
   * ⚠ A LOOKUP, not one value per wire. Both sealing entry points — the
   * sign-then-encrypt composition (`encrypt-outer.ts`) and `aegis.encrypt` handed an
   * already-minted token — resolve through it, and `aegis.encrypt` may be handed a
   * JWS, so a single per-wire value would declare a false plaintext type.
   *
   * ⚠ A format with NO entry has no registered media type on this wire: nothing is
   * stamped and the kit's codec infers from the value shape. A gap is honest where
   * an invented media type is not.
   */
  readonly nestedTokenCty: Readonly<Partial<Record<TokenFormatTag, string>>>;
  /**
   * Whether a sign-then-encrypt OUTER carries the inner's typ PREFIX.
   *
   * ⚠ THE TWO WIRES DIVERGE: the COSE outer stamps the prefix, the JOSE outer drops
   * it. Making them agree moves emitted bytes, so the difference is ONE flippable
   * value here rather than hand-written in each composition.
   */
  readonly nestedTokenTyp: "inner" | "none";
  /**
   * How this wire spells a profile's `typ` policy — what the verify FLOOR expects
   * the token's own type header to be.
   */
  profileTyp(typ: TokenProfileTyp): string | undefined;
  /**
   * The FULL type header a caller's `assert.tokenType` expects on this wire.
   *
   * ⚠ Full, not the bare prefix the kits take. A type whose short name is the bare
   * conventional form (`id_token` reduces to `JWT`) has NO prefix, and the kit gate
   * is `if (options.tokenType !== undefined)` — so a prefix would leave the
   * assertion unenforced for exactly that type.
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
   * Secure the caller's own content as this wire's OPAQUE signed token. Reached by
   * `aegis.jws.sign` / `aegis.cws.sign` through the shared entry
   * (`raw-sign-opaque.ts`), which runs `assertWireInput` over
   * {@link WireInputDispositions.signOpaque} first.
   *
   * ⚠ `aegis.sign` does NOT reach this; it is claims-only.
   *
   * ⚠ A separate operation from {@link signClaims}, not a mode of it: no claims
   * layer, a different option set, and different kit families. Folding them together
   * would put a discriminated union in the parameter and a branch in the body.
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
