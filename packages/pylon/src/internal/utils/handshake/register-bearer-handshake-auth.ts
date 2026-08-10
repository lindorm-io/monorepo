import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { assertResolvedAccess } from "../access-token/assert-resolved-access.js";
import { resolveAccess } from "../access-token/resolve-access.js";
import { assertDpopBinding } from "../dpop/assert-dpop-binding.js";
import { createBearerRefreshHandler } from "../refresh/create-bearer-refresh-handler.js";
import { reconstructHandshakeHtu } from "./reconstruct-handshake-htu.js";
import type {
  AccessTokenMatchers,
  HandshakeDpopMode,
  PylonAuthCacheEntry,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../../types/index.js";

type RegisterBearerHandshakeAuthOptions = {
  cache: PylonAuthCacheEntry | undefined;
  dpopMode: HandshakeDpopMode;
  dpopProof: string | undefined;
  matchers: AccessTokenMatchers;
  token: string;
};

/**
 * Resolve a handshake credential through the SAME `resolveAccess` the HTTP arm
 * runs, then register the auth state the connection lives on.
 *
 * Two things follow from sharing the resolver, and both are new here: an OPAQUE
 * credential now authenticates over a handshake (this path used to call
 * `aegis.parse` unconditionally, which throws `parse_requires_claims` on a
 * signed handle and `unsupported_token_type` on a bare one — so an opaque token
 * could not connect at all), and the mount's claim matchers apply to whichever
 * arm resolved it.
 *
 * The DPoP proof is pylon's to check, not aegis's: `resolveAccess` passes
 * `trustBoundThumbprint`, and `assertDpopBinding` runs the RFC 9449 §7.1 check
 * against the RECONSTRUCTED handshake `htu` — the same function HTTP uses, which
 * is what extends proof-of-possession to a DPoP-bound OPAQUE token here.
 */
export const registerBearerHandshakeAuth = async (
  ctx: PylonSocketHandshakeContext,
  { cache, dpopMode, dpopProof, matchers, token }: RegisterBearerHandshakeAuthOptions,
): Promise<void> => {
  const socket = ctx.io.socket;

  // Refused BEFORE the credential is resolved: "required" is a statement about
  // the request, and a request with no proof cannot satisfy it however good the
  // token turns out to be.
  if (dpopMode === "required" && !dpopProof) {
    throw new ClientError("Missing DPoP proof", {
      code: "handshake_dpop_proof_required",
      title: "Handshake DPoP Proof Required",
      type: "urn:lindorm:pylon:error:handshake_dpop_proof_required",
      details: "DPoP is required on this handshake but no DPoP header was sent",
      status: ClientError.Status.Unauthorized,
    });
  }

  const { access, issuer, verified } = await resolveAccess(ctx, token, {
    audience: matchers.audience,
    cache,
  });

  assertResolvedAccess(access, { issuer, matchers });

  const thumbprint = access.claims.confirmation?.thumbprint;
  const bound = isString(thumbprint) && thumbprint.length > 0;

  if (dpopMode === "required" && !bound) {
    throw new ClientError("Missing DPoP binding", {
      code: "handshake_dpop_binding_missing",
      title: "Handshake DPoP Binding Missing",
      type: "urn:lindorm:pylon:error:handshake_dpop_binding_missing",
      details: "DPoP is required but the access token has no cnf.jkt",
      status: ClientError.Status.Unauthorized,
    });
  }

  // "disabled" accepts a bound token as a plain bearer, so there is no binding
  // to check. In the other two modes the binding check is the SAME one HTTP
  // runs: it no-ops for an unbound token (a preemptively signed proof beside a
  // bearer-only token is simply ignored) and is strict for a bound one.
  if (dpopMode !== "disabled" && bound) {
    const htu = reconstructHandshakeHtu(socket.handshake);

    if (!htu) {
      throw new ClientError("Invalid DPoP proof", {
        code: "dpop_handshake_htu_unresolvable",
        title: "DPoP Handshake HTU Unresolvable",
        type: "urn:lindorm:pylon:error:dpop_handshake_htu_unresolvable",
        details: "Unable to reconstruct handshake htu — missing host header",
        status: ClientError.Status.Unauthorized,
      });
    }

    // A socket handshake is an HTTP GET upgrade request, so `htm` is fixed; and
    // there is no authorization SCHEME to read on it, so the mount's `dpop` mode
    // carries the "a bound token is asserted" intent instead.
    assertDpopBinding(access, { htm: "GET", htu, proof: dpopProof, scheme: false });
  }

  const dpopValidated = dpopMode !== "disabled" && bound;

  // ⚠ `tokens.bearer` is left UNSET for an OPAQUE credential — there is no
  // VerifiedToken behind an introspection answer, and synthesising one would
  // erase the provenance distinction. The connection's own record of what it
  // authenticated as is `pylon.access`, which BOTH arms produce.
  if (verified) socket.data.tokens.bearer = verified;
  socket.data.pylon.access = access;

  const auth: PylonSocketAuth = {
    strategy: dpopValidated ? "dpop-bearer" : "bearer",
    getExpiresAt: () => access.claims.expiresAt ?? new Date(0),
    refresh: async () => {},
    authExpiredEmittedAt: null,
  };
  auth.refresh = createBearerRefreshHandler({
    cache,
    capturedJkt: dpopValidated ? thumbprint : undefined,
    ctx,
    issuer,
    matchers,
    socket,
    subject: access.claims.subject,
  });
  socket.data.pylon.auth = auth;
};
