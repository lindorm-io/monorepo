import { JweKit } from "../../classes/JweKit.js";
import type { ProfileVerifyOptions, VerifiedToken } from "../../types/index.js";
import { isCose } from "../cose/is-cose.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";
import { extractDomainClaims } from "./extract-claims.js";
import { verifyCoseToken } from "./verify-cose-token.js";
import { verifyJwtToken } from "./verify-jwt.js";
import { verifyToken } from "./verify-token.js";

/**
 * The profiled domain verify pipeline (`aegis.verify(profile, token, options)` →
 * `NarrowedToken`). The encoding seam is AUTO-DETECTED, never told: a COSE token
 * verifies as a CWT/CWM (via `verifyCoseToken`), a JOSE token as a JWT/JWE. Verify
 * only ever inspects an existing format — mint chooses its output format. Returns
 * the unified `VerifiedToken`; the Aegis boundary narrows `.claims` to the
 * profile's `required` set (`NarrowedToken`).
 */
export const verifyProfileToken = async ({
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
  if (!token.includes(".") && isCose(Buffer.from(token, "base64url"))) {
    return verifyCoseToken({ name, token, options, deps });
  }

  const profile = resolveProfile(name);

  // The typ is enforced by enforceVerifyFloor against profile.typ, so we do NOT
  // also pass tokenType to the standard verify (which would compute its own typ
  // expectation and could disagree).
  const { audience: _audience, issuer: _issuer, clockTolerance: _ct, ...rest } = options;

  // A `lifetime: null` profile (RFC 8417 / SSF `security_event`, introspection,
  // userinfo) mints tokens with NO exp, so its verify must tolerate an absent exp
  // — the floor below owns the real presence policy.
  const expPresence = profile.lifetime === null ? "optional" : "required";

  // A JWE goes through verifyToken (decrypt + re-verify the signed inner); a bare
  // JWT verifies directly with `typPresence: "optional"` so a typ-less RFC 7523
  // client assertion reaches the floor (which owns the profile's typ presence
  // policy). Direct jwt.verify callers keep the strict default.
  const verified = JweKit.isJwe(token)
    ? await verifyToken({ token, options: { ...rest, expPresence }, deps })
    : await verifyJwtToken({
        token,
        options: { ...rest, typPresence: "optional", expPresence },
        deps,
      });

  const expectedIssuer =
    options.issuer ??
    (profile.issuer === "platform" ? (deps.issuer ?? undefined) : undefined);

  // DOMAIN-keyed floor payload from the RAW wire claims (`verified.wire.payload`),
  // not `verified.claims`: extractDomainClaims reports true wire presence and
  // leaves non-domain claims flat in `rest`, which the floor's required-claims
  // presence check needs.
  const { claims: domain, rest: custom } = extractDomainClaims(
    verified.wire?.payload ?? {},
  );

  enforceVerifyFloor({
    audience: options.audience,
    decodedTyp: verified.header.headerType,
    expectedIssuer,
    payload: { ...custom, ...domain },
    profile,
  });

  return verified;
};
