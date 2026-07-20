import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { JwtKit } from "../../classes/JwtKit.js";
import type { ParsedJwt, VerifyJwtOptions } from "../../types/index.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { parseTokenPayload } from "./jwt-payload.js";
import { validate } from "./validate.js";
import { validateActor } from "./validate-actor.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";

type Config = {
  clockTolerance: number;
  dpopMaxSkew: number;
};

/**
 * The Aegis DOMAIN verify half (R16 seed — Unit C lifts this into `verifyToken`).
 *
 * The wire `JwtKit.verify` has already run the structural + prudent SECURITY
 * checks (crit, typ well-formedness, algorithm-match, signature, cert-binding,
 * temporal range). This layer adds the DOMAIN policy the thinned kit no longer
 * owns: the claim translation to the domain shape, the named-claim identity
 * matchers, `exp` PRESENCE requiredness, actor/delegation, and the DPoP proof —
 * so `aegis.verify` resolves the SAME domain result the fat kit used to.
 */
export const verifyJwtToDomain = <C extends Dict = Dict>(
  kit: JwtKit,
  token: string,
  options: VerifyJwtOptions,
  config: Config,
  // Whether the JWT was the inner token of an ENCRYPTED outer (jwe). Drives the
  // read-side sensitive-claim gate: sensitive claims (OIDC Core §13.3) surface
  // only when this is true, and are suppressed otherwise.
  encrypted: boolean,
): ParsedJwt<C> => {
  // The kit asserts the header typ from a bare PREFIX it re-wraps; Aegis derives
  // that prefix from the domain `tokenType`.
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

  // Translate to the domain shape (also enforces the `iss` presence gate) and
  // summarise the delegation chain from the wire `act` claim.
  const payload = parseTokenPayload<C>(decoded.payload, encrypted);
  const delegation = extractTokenDelegation(decoded.payload as { act?: any });

  const parsed: ParsedJwt<C> = { decoded, delegation, header, payload, token };

  const clockTolerance = config.clockTolerance;

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
  // before the generic matcher pass so callers keying on it keep working;
  // "optional" (profiled SETs) skips it. When present, the range was already
  // checked by the kit's temporal matcher.
  if (options.expPresence !== "optional" && withDates.exp === undefined) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "jwt_missing_claim_exp",
      title: "JWT Missing Claim Exp",
      details:
        'The token has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // Named-claim identity matchers (aud/iss/sub/hashes/…) built from the verify
  // options — the AEGIS half of the old `createJwtVerify`.
  try {
    validate(
      withDates,
      createIdentityMatchers(kit.algorithm, options, clockTolerance) as never,
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

  const boundThumbprint = payload.confirmation?.thumbprint;

  if (options.dpopProof !== undefined) {
    if (!boundThumbprint) {
      throw new AegisDomainError(
        "Invalid token: DPoP proof provided but token is not bound",
        {
          code: "jwt_dpop_token_not_bound",
          debug: { confirmation: payload.confirmation },
          title: "JWT DPoP Token Not Bound",
          details:
            "A DPoP proof was supplied but the token carries no cnf.jkt thumbprint, so it cannot be DPoP-bound.",
        },
      );
    }
    parsed.dpop = verifyDpopProof({
      proof: options.dpopProof,
      accessToken: token,
      expectedThumbprint: boundThumbprint,
      dpopMaxSkew: config.dpopMaxSkew,
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

  return parsed;
};
