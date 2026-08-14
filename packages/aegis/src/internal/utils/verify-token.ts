import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type {
  ProfileVerifyOptions,
  TokenProfile,
  VerifiedToken,
  VerifyAssert,
  VerifyOptions,
} from "../../types/index.js";
import { wireToFloorClaims } from "../claims/translate.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyVerifyPolicy } from "./apply-verify-policy.js";
import { buildTokenResult } from "./build-token-result.js";
import { decryptOuter } from "./decrypt-outer.js";
import { detectTokenFormat } from "./detect-token-format.js";
import { domainTokenHeader } from "./domain-header.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";
import { isClaimsContentType } from "./is-claims-content-type.js";
import { TOKEN_FORMAT_KIND } from "./token-format-kind.js";

/**
 * The profile a verification is held to, resolved once. Threaded down through an
 * encrypting outer, so the signed inner is judged by the floor the caller named
 * rather than by whatever the peel happened to leave behind.
 */
export type VerifyFloor = {
  profile: TokenProfile;
  audience: string;
  /**
   * The issuer this verifier accepts. Its FIRST job is to SCOPE the key lookup,
   * so a colliding `kid` from another registered issuer never gets to produce a
   * valid signature; the floor's `iss` comparison is the second.
   */
  expectedIssuer: string | undefined;
};

const REQUIRES_SIGNATURE_DETAILS =
  "aegis.verify requires sender authentication: an encrypted token must decrypt to a signed token of this wire. This one's plaintext is not — read confidential, unsigned encrypted claims with aegis.decrypt instead.";

/**
 * Resolve the profile half of a profiled verify. Separated from the pipeline only
 * because it is argument normalisation: it reads the caller's options, never the
 * token.
 */
export const resolveVerifyFloor = (
  name: string,
  options: ProfileVerifyOptions,
  deps: AegisDeps,
): VerifyFloor => {
  const profile = deps.resolveProfile(name);

  // The mirror of the mint refusal: a profile that declares itself mint-only
  // makes no statement about a token arriving from outside, so verifying against
  // it would report a floor it was never written to be a floor for.
  if (profile.use === "mint") {
    throw new AegisDomainError("Profile cannot be verified", {
      code: "profile_not_verifiable",
      data: { profile: profile.name, use: profile.use },
      title: "Profile Not Verifiable",
      details:
        "This token profile declares itself mint-only, so it carries no verification policy and cannot be used to verify a token. Use the profile that owns the artifact you are reading.",
    });
  }

  return {
    profile,
    audience: options.audience,
    expectedIssuer:
      options.issuer ??
      (profile.issuer === "platform" ? (deps.issuer ?? undefined) : undefined),
  };
};

/**
 * THE domain verify pipeline (`aegis.verify`, profiled and not) — one
 * implementation for every format on either wire.
 *
 * The encoding is AUTO-DETECTED, never told: verify only ever inspects a token
 * that already exists. From there the shape decides the path, and each path has
 * exactly one body:
 *
 * - ENCRYPTED (`jwe`/`cwe`): peeled, then the plaintext is re-verified. `verify`
 *   means authenticity, so the plaintext MUST itself be a signed token of this
 *   wire; confidential-but-unsigned claims are read with `aegis.decrypt`. The
 *   OUTER format is reported with the inner's under `inner`.
 * - OPAQUE (`jws`/`cws`): the signature is checked and the payload delivered as
 *   `raw` beside an empty domain — there is no claims layer to read.
 * - CLAIMS (`jwt`/`cwt`/`cwm`): integrity, then the domain policy, then — when
 *   the caller named a profile — that profile's floor.
 *
 * It was five functions with two of everything. What the copies had actually
 * diverged on: the opaque JOSE branch dropped the caller's key policy where its
 * COSE twin threaded it; the COSE floor was fed a full domain read where the JOSE
 * floor got the wire-name read; the typ- and exp-presence defaults were decided in
 * three places, one of which disagreed; and the profiled and profile-less COSE
 * paths each assembled their own result. The shared claim translation and the
 * shared policy tail were already in place before this step — it is the paths
 * around them that were two.
 */
export const verifyToken = async <C extends Dict = Dict>({
  token,
  assert,
  options = {},
  deps,
  floor,
  encrypted = false,
  issuer,
}: {
  token: string;
  assert?: VerifyAssert;
  options?: VerifyOptions;
  deps: AegisDeps;
  /** The profile floor, when the caller named one. */
  floor?: VerifyFloor;
  /**
   * True once an encrypting outer has been peeled: the claims were delivered
   * encrypted, so sensitive ones (the aegis confidentiality gate) may surface.
   */
  encrypted?: boolean;
  /** The issuer the VERIFIER expects. Survives the peel, so the inner is scoped too. */
  issuer?: string;
}): Promise<VerifiedToken<C>> => {
  const format = detectTokenFormat(token);

  if (format === undefined) {
    // A peeled plaintext that is not a token at all cannot be sender-
    // authenticated, and saying "unsupported token type" about it would name the
    // wrong problem — the caller handed us a perfectly good encrypted token.
    if (encrypted) {
      throw new AegisDomainError(
        "Encrypted token does not contain a signed inner token",
        {
          code: "verify_requires_signature",
          debug: { token: sanitiseToken(token) },
          title: "Verify Requires Signature",
          details: REQUIRES_SIGNATURE_DETAILS,
        },
      );
    }

    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token: sanitiseToken(token) },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JOSE (JWT/JWS/JWE) or COSE (CWT/CWM/CWS/CWE) token, so Aegis cannot select a kit to verify it.",
    });
  }

  const wire = tokenWireFor(format);

  // ---- the encrypting outer ------------------------------------------------
  if (TOKEN_FORMAT_KIND[format] === "encrypted") {
    const { inner, contentType } = await decryptOuter(wire, token, deps);
    const innerFormat = inner === undefined ? undefined : detectTokenFormat(inner);

    // `verify` = authenticity. A plaintext that is not one of the signed forms
    // this wire admits proves nothing about who produced it.
    if (inner === undefined || innerFormat === undefined) {
      throw new AegisDomainError(
        "Encrypted token does not contain a signed inner token",
        {
          code: "verify_requires_signature",
          data: { format },
          debug: { token: sanitiseToken(token) },
          title: "Verify Requires Signature",
          details: REQUIRES_SIGNATURE_DETAILS,
        },
      );
    }

    // A `cty` is a DECLARATION about the plaintext, and one that names a nested
    // CLAIMS token (RFC 7519 §5.2) must be TRUE: a wrapper that says "claims
    // inside" and delivers an opaque signature would verify to an EMPTY domain,
    // which a caller routing on the declaration reads as an authenticated
    // credential with nothing in it.
    if (isClaimsContentType(contentType) && TOKEN_FORMAT_KIND[innerFormat] !== "claims") {
      throw new AegisDomainError(
        "Encrypted token does not contain the declared claims token",
        {
          code: "verify_inner_type_mismatch",
          data: { contentType, format, inner: innerFormat },
          debug: { token: sanitiseToken(token) },
          title: "Verify Inner Type Mismatch",
          details:
            "The encrypted token declares a nested claims token in its content type but its plaintext is not one. A token whose envelope misdescribes its content cannot be trusted to carry the claims it advertises.",
        },
      );
    }

    if (!wire.encryptedInner.includes(innerFormat)) {
      throw new AegisDomainError(
        "Encrypted token does not contain a signed inner token",
        {
          code: "verify_requires_signature",
          data: { format, inner: innerFormat },
          debug: { token: sanitiseToken(token) },
          title: "Verify Requires Signature",
          details: REQUIRES_SIGNATURE_DETAILS,
        },
      );
    }

    const verified = await verifyToken<C>({
      token: inner,
      assert,
      options,
      deps,
      floor,
      encrypted: true,
      issuer,
    });

    return {
      ...verified,
      format,
      inner: verified.format as VerifiedToken["inner"],
    };
  }

  // `tokenType` asserts the token's TYPE, which BOTH wires carry in a HEADER
  // rather than a claim — so the kit enforces it and it must NOT reach the claim
  // predicate. The rest of `assert` is claim matchers.
  const { tokenType, ...claimMatchers } = assert ?? {};

  // ---- an opaque signed token ---------------------------------------------
  if (TOKEN_FORMAT_KIND[format] === "opaque") {
    if (floor) {
      throw new AegisDomainError("Profile requires a claims token", {
        code: "profile_requires_claims",
        data: { profile: floor.profile.name, format },
        debug: { token: sanitiseToken(token) },
        title: "Profile Requires Claims",
        details:
          "An opaque signed token carries no claims layer, so a profile floor — which is a statement about claims — cannot be applied to it. Verify it without a profile.",
      });
    }

    // ⚠ `tokenType` is NOT asserted on this branch, and never has been: the
    // opaque kit verify has no typ hook at all (`VerifyUnstructuredTokenOptions`
    // is `{ certBindingMode }`), so there is nothing to thread it to. Recorded
    // rather than silently dropped — giving it one is a kit change.
    const verified = await wire.verifyOpaque({ token, deps, options });

    return {
      format,
      header: domainTokenHeader(
        {
          protectedHeader: verified.protectedHeader,
          unprotectedHeader: verified.unprotectedHeader,
        },
        format,
      ),
      claims: {},
      custom: {} as C,
      raw: verified.payload,
      token,
    };
  }

  // ---- a claims-bearing token ---------------------------------------------
  const read = await wire.verifyClaims({
    token,
    deps,
    options,
    issuer: issuer ?? floor?.expectedIssuer,
  });

  // The caller's own type assertion, ONE implementation for both wires.
  //
  // ⚠ It lives here and not in the kits, and the whole media type is compared
  // rather than the bare prefix the kits take. A type whose short name IS the
  // bare conventional form — `id_token` reduces to `JWT` — yields no prefix at
  // all, and the kits gate their check on the prefix being defined, so for
  // exactly that type the assertion silently did not run.
  if (tokenType !== undefined) {
    const expected = wire.assertedTyp(tokenType);

    if (read.protectedHeader.typ !== expected) {
      throw new AegisDomainError("Invalid token", {
        code: "token_type_mismatch",
        data: { typ: read.protectedHeader.typ, format: read.format },
        debug: { expected, tokenType },
        title: "Token Type Mismatch",
        details:
          "The token's type header does not match the tokenType asserted for this verification.",
      });
    }
  }

  const result = buildTokenResult<C>({
    format: read.format,
    wire: read.wire,
    protectedHeader: read.protectedHeader,
    unprotectedHeader: read.unprotectedHeader,
    token,
    encrypted,
    nameOf: wire.nameOf,
    issuerPresence: wire.issuerPresence,
  });

  // typ/exp presence, the caller's identity matchers, the actor chain and the
  // DPoP binding — one implementation, so a knob cannot be honoured on one wire
  // and dropped on the other.
  const { dpop } = applyVerifyPolicy({
    wireClaims: read.matcher,
    claims: result.claims,
    delegation: result.delegation,
    decodedTyp: read.protectedHeader.typ,
    algorithm: read.algorithm,
    assert: claimMatchers,
    options,
    format: read.format,
    nameOf: wire.nameOf,
    defaultTypPresence: wire.defaultTypPresence,
    token,
    dpopMaxSkew: deps.dpopMaxSkew,
  });

  if (floor) {
    // The floor payload comes from the RAW wire claims, not from `result.claims`:
    // it reports true wire presence and leaves every non-domain claim flat under
    // its ORIGINAL spelling, which is what a presence check needs. Both wires read
    // it the same way — the COSE floor used to get the full domain read instead,
    // where a custom `expires_at` had already been camelCased into an `expiresAt`
    // that satisfied the exp-presence check.
    const { claims: domain, custom } = wireToFloorClaims(read.wire, wire.nameOf);

    enforceVerifyFloor({
      algorithm: read.algorithm,
      audience: floor.audience,
      decodedTyp: read.protectedHeader.typ,
      expectedTyp: wire.profileTyp(floor.profile.typ),
      expectedIssuer: floor.expectedIssuer,
      format: read.format,
      payload: { ...custom, ...domain },
      profile: floor.profile,
    });
  }

  return { ...result, dpop };
};
