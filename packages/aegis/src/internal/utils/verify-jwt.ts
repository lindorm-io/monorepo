import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError } from "../../errors/index.js";
import type { DomainAssert, VerifiedToken, VerifyOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { buildDomainClaims } from "./jwt-payload.js";
import { validate } from "./validate.js";
import { validateActor } from "./validate-actor.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";

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
}: {
  token: string;
  assert?: DomainAssert;
  options?: VerifyOptions;
  deps: AegisDeps;
  // Whether the JWT was the inner token of an ENCRYPTED outer (jwe). Drives the
  // read-side sensitive-claim gate (OIDC Core §13.3).
  encrypted?: boolean;
}): Promise<VerifiedToken<C>> => {
  const decode = JwtKit.decodeSegments(token);

  const kryptos = await deps.resolveVerifyKey(
    decode.header.kid,
    decode.header.alg as KryptosSigAlgorithm,
    options.key,
  );

  const kit = new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  });

  // The kit asserts the header typ from a bare PREFIX it re-wraps; derive that
  // prefix from the domain `tokenType`.
  const wire = kit.verify<C>(token, undefined, {
    typ:
      options.tokenType !== undefined
        ? extractTypPrefix(computeTypHeader(options.tokenType, "jwt"))
        : undefined,
  });

  const { decoded, header } = wire;

  // typ PRESENCE policy (default "required") — the RFC 8725 explicit-typing
  // defense. Profiled verify relaxes to "optional" (the floor owns it).
  if (options.typPresence !== "optional" && decoded.header.typ === undefined) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_invalid_typ",
      data: { typ: decoded.header.typ },
      title: "JWT Invalid Typ",
      details:
        "Header typ is absent; a typ of JWT or a <type>+jwt media type is required to verify as a JWT.",
    });
  }

  // Domain buckets (enforces the `iss` presence gate) + the delegation summary.
  const { claims, custom, profile, sensitive } = buildDomainClaims<C>(
    decoded.payload,
    encrypted,
  );
  const delegation = extractTokenDelegation(decoded.payload as { act?: any });

  const withDates = {
    ...decoded.payload,
    exp: decoded.payload.exp ? new Date(decoded.payload.exp * 1000) : undefined,
    iat: decoded.payload.iat ? new Date(decoded.payload.iat * 1000) : undefined,
    nbf: decoded.payload.nbf ? new Date(decoded.payload.nbf * 1000) : undefined,
    auth_time: decoded.payload.auth_time
      ? new Date(decoded.payload.auth_time * 1000)
      : undefined,
  };

  // `exp` PRESENCE is policy (default "required"). Surface the dedicated code
  // before the generic matcher pass; "optional" (profiled SETs) skips it. When
  // present, the range was already checked by the kit's temporal matcher.
  if (options.expPresence !== "optional" && withDates.exp === undefined) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "jwt_missing_claim_exp",
      title: "JWT Missing Claim Exp",
      details:
        'The token has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // Named-claim identity matchers (aud/iss/sub/hashes/…) — the AEGIS half of the
  // old `createJwtVerify`. The matcher bag is the domain `assert` merged with the
  // three hash-derive inputs lifted from verify OPTIONS.
  const matchers = omitUndefined({
    ...assert,
    accessToken: options.accessToken,
    authCode: options.authCode,
    authState: options.authState,
  });
  try {
    validate(
      withDates,
      createIdentityMatchers(
        kit.algorithm,
        matchers,
        deps.clockTolerance,
        options.expPresence,
      ) as never,
    );
  } catch (err) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_claims_invalid",
      data: { invalid: (err as any).data?.invalid },
      debug: { invalid: (err as any).debug?.invalid },
      title: "JWT Claims Invalid",
      details:
        "One or more claims (such as a verifier-supplied claim) failed the validation predicate.",
    });
  }

  const actorError = validateActor(delegation, options.actor);
  if (actorError) {
    throw new AegisDomainError(actorError.message, {
      code: "jwt_actor_not_allowed",
      debug: actorError.debug,
      title: "JWT Actor Not Allowed",
      details:
        "The token's act delegation chain does not satisfy the expected actor supplied to verify.",
    });
  }

  const boundThumbprint = claims.confirmation?.thumbprint;

  let dpop;
  if (options.dpopProof !== undefined) {
    if (!boundThumbprint) {
      throw new AegisDomainError(
        "Invalid token: DPoP proof provided but token is not bound",
        {
          code: "jwt_dpop_token_not_bound",
          debug: { confirmation: claims.confirmation },
          title: "JWT DPoP Token Not Bound",
          details:
            "A DPoP proof was supplied but the token carries no cnf.jkt thumbprint, so it cannot be DPoP-bound.",
        },
      );
    }
    dpop = verifyDpopProof({
      proof: options.dpopProof,
      accessToken: token,
      expectedThumbprint: boundThumbprint,
      dpopMaxSkew: deps.dpopMaxSkew,
    });
  } else if (boundThumbprint && !options.trustBoundThumbprint) {
    throw new AegisDomainError(
      "Invalid token: token is DPoP-bound but no DPoP proof was provided",
      {
        code: "jwt_dpop_proof_required",
        title: "JWT DPoP Proof Required",
        details:
          "The token carries a cnf.jkt thumbprint, so a matching DPoP proof must be supplied unless trustBoundThumbprint is set.",
      },
    );
  }

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
