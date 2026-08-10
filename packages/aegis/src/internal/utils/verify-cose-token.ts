import type { ProfileVerifyOptions, VerifiedToken } from "../../types/index.js";
import { coseTyp } from "../cose/cose-typ.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildCoseVerifiedToken } from "./build-cose-verified-token.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";

/**
 * Profiled COSE verify: the COSE sibling of the JOSE `verifyProfileToken` path.
 * Verify the CWT/CWM integrity (via `coseVerifyCore`), apply the profile floor
 * against the profile's expected COSE typ + issuer, then assemble the unified
 * {@link VerifiedToken}. A COSE_Encrypt0 (cwe) outer reports `format: "cwe"` with
 * the inner claims-format under `inner`.
 */
export const verifyCoseToken = async ({
  name,
  token,
  options,
  deps,
}: {
  name: string;
  token: string;
  options: ProfileVerifyOptions;
  deps: AegisDeps;
}): Promise<VerifiedToken> => {
  const profile = resolveProfile(name);

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

  enforceVerifyFloor({
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
