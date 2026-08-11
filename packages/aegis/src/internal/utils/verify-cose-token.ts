import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { AegisDomainError } from "../../errors/index.js";
import type {
  ProfileVerifyOptions,
  VerifiedToken,
  VerifyAssert,
} from "../../types/index.js";
import { coseTyp } from "../cose/cose-typ.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildCoseVerifiedToken } from "./build-cose-verified-token.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";
import { validateCwtClaims } from "./validate-cwt-claims.js";

/**
 * Profiled COSE verify: the COSE sibling of the JOSE `verifyProfileToken` path.
 * Verify the CWT/CWM integrity (via `coseVerifyCore`), apply the caller's `assert`
 * matchers and the profile floor against the profile's expected COSE typ + issuer,
 * then assemble the unified {@link VerifiedToken}. A COSE_Encrypt0 (cwe) outer
 * reports `format: "cwe"` with the inner claims-format under `inner`.
 */
export const verifyCoseToken = async ({
  name,
  token,
  assert,
  options,
  deps,
}: {
  name: string;
  token: string;
  assert?: VerifyAssert;
  options: ProfileVerifyOptions;
  deps: AegisDeps;
}): Promise<VerifiedToken> => {
  const profile = resolveProfile(name);

  // A mint-only profile cannot verify on this wire either — `verifyProfileToken`
  // dispatches here BEFORE it resolves the profile, so the COSE reader owns the
  // same refusal rather than inheriting it.
  if (profile.use === "mint") {
    throw new AegisDomainError("Profile cannot be verified", {
      code: "jwt_profile_not_verifiable",
      data: { profile: profile.name, use: profile.use },
      title: "JWT Profile Not Verifiable",
      details:
        "This token profile declares itself mint-only, so it carries no verification policy and cannot be used to verify a token. Use the profile that owns the artifact you are reading.",
    });
  }

  // Computed BEFORE the verify, exactly as on the JOSE side: its first job is to
  // SCOPE the key lookup to the issuer this verifier accepts, so a colliding
  // `kid` from another registered issuer never produces a valid signature. The
  // floor's `iss` comparison below is the second job.
  const expectedIssuer =
    options.issuer ??
    (profile.issuer === "platform" ? (deps.issuer ?? undefined) : undefined);

  const { claims, wire, decoded, typ, encrypted } = await coseVerifyCore({
    input: Buffer.from(token, "base64url"),
    clockTolerance: options.clockTolerance,
    currentDate: options.currentDate,
    maxTokenAge: options.maxTokenAge,
    verifyExpiration: options.verifyExpiration,
    verifyNotBefore: options.verifyNotBefore,
    verifyIssuedAt: options.verifyIssuedAt,
    verifyAuthTime: options.verifyAuthTime,
    deps,
    issuer: expectedIssuer,
  });

  // The caller's matchers, applied by the SAME site the profile-less COSE path
  // uses — the mirror of the JOSE half, where `verifyJwtToken` applies `assert`
  // before the floor runs. `validateCwtClaims` owns the domain->wire naming (via
  // the claims registry) and the COSE spelling of the `tokenType` assertion, so
  // the profiled path adds no second assertion site.
  //
  // `expPresence` is pinned "optional" because the floor below owns the profile's
  // exp policy (`profile.lifetime`) and covers exactly the same tokens; letting
  // the matcher check it too would give one condition two error codes.
  //
  // A caller asserting `tokenType` gets that check HERE and the profile's own typ
  // at the floor. Both derive through the one `coseTyp` mapping mint stamps with,
  // so an agreeing pair both pass and a disagreeing one is a matcher the caller
  // asked for and that is false — the same answer the JOSE half gives.
  validateCwtClaims({
    wire,
    typ,
    algorithm: decoded.algorithm as KryptosAlgorithm,
    assert,
    options: { expPresence: "optional" },
  });

  enforceVerifyFloor({
    // The protected-header alg, which `verifyCwt` has already refused to accept
    // unless it equals the resolved key's algorithm (`cwt_algorithm_mismatch` /
    // `cwm_algorithm_mismatch`) — the COSE twin of the JOSE cross-check.
    algorithm: decoded.algorithm,
    audience: options.audience,
    decodedTyp: typ,
    expectedTyp: coseTyp(profile.typ),
    expectedIssuer,
    payload: claims,
    profile,
  });

  const verified = buildCoseVerifiedToken({ wire, decoded, token, encrypted });

  // A COSE_Encrypt0 (cwe) wrapped a signed inner CWT/CWM: report the OUTER `cwe`
  // format with the inner claims-format under `inner`.
  return encrypted
    ? { ...verified, format: "cwe", inner: verified.format as VerifiedToken["inner"] }
    : verified;
};
