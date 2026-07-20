import { coseTyp } from "../cose/cose-typ.js";
import { resolveProfile } from "../profiles/registry.js";
import type { ParsedJws, ParsedJwt, ProfileVerifyOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";

/**
 * Profiled COSE verify: the COSE sibling of the JOSE `verifyProfileToken` path.
 * Verify the CWT's integrity (via `coseVerifyCore`) then apply the profile floor
 * against the profile's expected COSE typ + issuer.
 */
export const verifyCoseToken = async <T extends ParsedJwt | ParsedJws<any>>({
  name,
  token,
  options,
  deps,
}: {
  name: string;
  token: string;
  options: ProfileVerifyOptions;
  deps: AegisDeps;
}): Promise<T> => {
  const profile = resolveProfile(name);
  const { claims, decoded, typ } = await coseVerifyCore({
    input: Buffer.from(token, "base64url"),
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

  return { claims, header: decoded } as unknown as T;
};
