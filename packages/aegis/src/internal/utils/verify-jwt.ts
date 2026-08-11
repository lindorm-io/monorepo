import { isString } from "@lindorm/is";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type { VerifiedToken, VerifyAssert, VerifyOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyVerifyPolicy, JOSE_VERIFY_CODEC } from "./apply-verify-policy.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { joseDomainHeader } from "./jose-domain-header.js";
import { buildDomainClaims } from "./jwt-payload.js";

/**
 * The domain JWT verify (`aegis.verify(token)` JWT branch → `VerifiedToken`).
 *
 * Resolves the verify key by `kid` (per-call `key` injection preserved), runs the
 * wire `JwtKit.verify` (crit, typ well-formedness, algorithm-match, signature,
 * cert-binding, temporal range — R10), then adds the DOMAIN policy the thinned kit
 * no longer owns: typ/exp PRESENCE, the named-claim identity matchers, actor /
 * delegation, and the DPoP proof — and ASSEMBLES the unified `VerifiedToken`
 * (domain `claims`/`custom`/`profile`/`sensitive` buckets + full-breadth domain
 * `header` + the untranslated `wire.payload`). Format is always `"jwt"` here; the
 * `verifyToken` JWE branch overrides it to `"jwe"` + `inner` when the JWT was a
 * decrypted inner token.
 */
export const verifyJwtToken = async <C extends Dict = Dict>({
  token,
  assert,
  options = {},
  deps,
  encrypted = false,
  issuer,
}: {
  token: string;
  assert?: VerifyAssert;
  options?: VerifyOptions;
  deps: AegisDeps;
  // Whether the JWT was the inner token of an ENCRYPTED outer (jwe). Drives the
  // read-side sensitive-claim gate (OIDC Core §13.3).
  encrypted?: boolean;
  // The issuer the VERIFIER expects, when it declared one (profiled verify).
  // Takes precedence over the token's own `iss` for scoping the key lookup — a
  // verifier that has already decided which issuer it will accept must not have
  // that decision re-opened by the artifact.
  issuer?: string;
}): Promise<VerifiedToken<C>> => {
  const decode = JwtKit.decode(token);

  // Verifier-declared issuer wins; else the token's own UNVERIFIED `iss`; else
  // unscoped. The unverified value is safe here because the scope only ever
  // NARROWS the candidate keys — a lie produces a miss, never a wider search
  // (`ResolveKeyOptions.issuer`). The `iss` claim itself is still checked, and
  // only ever after the signature.
  const kryptos = await deps.resolveVerifyKey({
    id: decode.header.kid,
    algorithm: decode.header.alg as KryptosSigAlgorithm,
    issuer: issuer ?? (isString(decode.payload.iss) ? decode.payload.iss : undefined),
    verify: options.key,
  });

  const kit = new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  });

  // `tokenType` asserts the token's TYPE, which JOSE carries in the `typ`
  // HEADER — so the kit enforces it, and it must NOT reach the claim predicate
  // (no claim holds it). The rest of `assert` is claim matchers.
  const { tokenType, ...claimMatchers } = assert ?? {};

  // The kit asserts the header typ from a bare PREFIX it re-wraps; derive that
  // prefix from the domain `tokenType`.
  kit.verify<C>(token, undefined, {
    clockTolerance: options.clockTolerance,
    currentDate: options.currentDate,
    maxTokenAge: options.maxTokenAge,
    verifyExpiration: options.verifyExpiration,
    verifyNotBefore: options.verifyNotBefore,
    verifyIssuedAt: options.verifyIssuedAt,
    verifyAuthTime: options.verifyAuthTime,
    tokenType:
      tokenType !== undefined
        ? extractTypPrefix(computeTypHeader(tokenType, "jwt"))
        : undefined,
  });

  // The kit verify no longer surfaces a `decoded` sub-object; the segments come
  // from the cheap `decode` above (identical header + cleartext claims).
  const decoded = decode;

  // The raw kit verify returns the WIRE header; the domain `VerifiedToken` carries
  // the DOMAIN-named header, so translate here (the JOSE twin of coseDomainHeader).
  const header = joseDomainHeader(decoded.header, "JWT");

  // Domain buckets (enforces the `iss` presence gate) + the delegation summary.
  const { claims, custom, profile, sensitive } = buildDomainClaims<C>(
    decoded.payload,
    encrypted,
  );
  const delegation = extractTokenDelegation(decoded.payload as { act?: any });

  // The matcher input: the wire payload with its temporal claims as `Date`s. The
  // COSE kit already hands its wire back in that shape, so both wires reach the
  // shared policy with the same kind of dict.
  const withDates = {
    ...decoded.payload,
    exp: decoded.payload.exp ? new Date(decoded.payload.exp * 1000) : undefined,
    iat: decoded.payload.iat ? new Date(decoded.payload.iat * 1000) : undefined,
    nbf: decoded.payload.nbf ? new Date(decoded.payload.nbf * 1000) : undefined,
    auth_time: decoded.payload.auth_time
      ? new Date(decoded.payload.auth_time * 1000)
      : undefined,
  };

  // typ/exp presence, the identity matchers, the actor chain and the DPoP
  // binding — ONE implementation, shared with the COSE path.
  const { dpop } = applyVerifyPolicy({
    wireClaims: withDates,
    claims,
    delegation,
    decodedTyp: decoded.header.typ,
    algorithm: kit.algorithm,
    assert: claimMatchers,
    options,
    codec: JOSE_VERIFY_CODEC,
    token,
    dpopMaxSkew: deps.dpopMaxSkew,
  });

  return {
    format: "jwt",
    header,
    claims,
    custom,
    profile,
    sensitive,
    delegation,
    dpop,
    wire: { payload: decoded.payload },
    token,
  };
};
