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
  const { claims, wire, decoded, typ, encrypted } = await coseVerifyCore({
    input: Buffer.from(token, "base64url"),
    currentDate: options.currentDate,
    maxTokenAge: options.maxTokenAge,
    deps,
  });

  const expectedIssuer =
    options.issuer ??
    (profile.issuer === "platform" ? (deps.issuer ?? undefined) : undefined);

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
