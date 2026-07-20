import type { Dict } from "@lindorm/types";
import { JweKit } from "../../classes/JweKit.js";
import type { ParsedJws, ParsedJwt, ProfileVerifyOptions } from "../../types/index.js";
import { isCose } from "../cose/is-cose.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { enforceVerifyFloor } from "./enforce-verify-floor.js";
import { extractDomainClaims } from "./extract-claims.js";
import { verifyCoseToken } from "./verify-cose-token.js";
import { verifyToken } from "./verify-token.js";

/**
 * The profiled domain verify pipeline (`aegis.verify(profile, token, options)`).
 * The encoding seam is AUTO-DETECTED, never told: a COSE token verifies as a
 * CWT (via `verifyCoseToken`), a JOSE token as a JWT/JWE. Verify only ever
 * inspects an existing format — mint chooses its output format.
 */
export const verifyProfileToken = async <T extends ParsedJwt | ParsedJws<any>>({
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
  if (!token.includes(".") && isCose(Buffer.from(token, "base64url"))) {
    return verifyCoseToken<T>({ name, token, options, deps });
  }

  const profile = resolveProfile(name);

  // The typ is enforced by enforceVerifyFloor against profile.typ, so we do
  // NOT also pass tokenType to the standard verify (which would compute its
  // own typ expectation and could disagree).
  const { audience: _audience, issuer: _issuer, clockTolerance: _ct, ...rest } = options;

  // A `lifetime: null` profile (RFC 8417 / SSF `security_event`, introspection,
  // userinfo) mints tokens with NO exp, so its verify must tolerate an absent
  // exp — the floor below owns the real presence policy. Finite-lifetime
  // profiles stay `"required"` (belt-and-suspenders with the floor's exp check).
  const expPresence = profile.lifetime === null ? "optional" : "required";

  // The typ-sniffing dispatcher (verifyToken) cannot classify a typ-less
  // JWS, but profiled verify knows the format from the profile — so only a
  // JWE goes through verifyToken (decrypt + re-verify the inner JWT); bare
  // tokens verify as JWTs directly, with `typPresence: "optional"` so a
  // typ-less RFC 7523 client assertion reaches the floor, which owns the
  // profile's typ presence policy (required-presence profiles still reject
  // an absent typ there). Direct jwt.verify callers keep the strict default.
  const parsed = JweKit.isJwe(token)
    ? await verifyToken<ParsedJwt>({ token, options: { ...rest, expPresence }, deps })
    : await deps.verifyJwt(token, { ...rest, typPresence: "optional", expPresence });

  const expectedIssuer =
    options.issuer ??
    (profile.issuer === "platform" ? (deps.issuer ?? undefined) : undefined);

  // DOMAIN-keyed floor payload from the RAW wire claims, not parsed.payload:
  // parseTokenPayload defaults absent set-valued claims to [] and nests
  // custom claims under `claims`, which would defeat the floor's
  // required-claims presence check. extractDomainClaims reports true wire
  // presence and leaves non-domain claims flat in `rest`.
  const { claims: domain, rest: custom } = extractDomainClaims(
    parsed.decoded.payload as Dict,
  );

  enforceVerifyFloor({
    audience: options.audience,
    decodedTyp: parsed.decoded.header.typ,
    expectedIssuer,
    payload: { ...custom, ...domain },
    profile,
  });

  return parsed as T;
};
