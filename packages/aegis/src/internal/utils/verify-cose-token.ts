import { coseTyp } from "../cose/cose-typ.js";
import { resolveProfile } from "../profiles/registry.js";
import type { ParsedJws, ParsedJwt, ProfileVerifyOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";
import { extractSensitiveClaims } from "./extract-sensitive-claims.js";

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
  const { claims, decoded, typ, encrypted } = await coseVerifyCore({
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

  // §13.3 gate: surface FLAT sensitive claims only from an encrypted CWT (cwe);
  // strip them on an unencrypted one. Run after the floor (which is unaffected
  // by sensitive claims — no profile requires or forbids one).
  const surfaced = encrypted ? claims : extractSensitiveClaims(claims).rest;

  return { claims: surfaced, header: decoded } as unknown as T;
};
