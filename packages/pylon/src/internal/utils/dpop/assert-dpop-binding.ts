import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { PylonResolvedAccess } from "../../../types/index.js";
import { assertDpopMatch } from "./assert-dpop-match.js";

export type DpopBinding = {
  /** RFC 9449 §4.2 `htm` — the method the proof must claim. */
  htm: string;
  /**
   * RFC 9449 §4.2 `htu` in components, query and fragment already stripped. HTTP
   * reads it off the request; a socket handshake reconstructs it from the
   * upgrade request.
   */
  htu: { origin: string; path: string };
  /** The raw DPoP proof the transport carried, when one was sent. */
  proof: string | undefined;
  /**
   * True when the credential was presented UNDER the DPoP scheme (RFC 9449
   * §7.1), which asserts a bound token. HTTP reads it off `Authorization: DPoP`;
   * a handshake has no authorization scheme to read, so it passes `false` and
   * the mount's `dpop` mode carries that intent instead.
   */
  scheme: boolean;
};

/**
 * The RFC 9449 §7.1 resource-server binding check, driven by `(proof, cnf.jkt,
 * token)` — the three things available on BOTH credential paths and on BOTH
 * transports. A locally verified token carries `cnf.jkt` in its own claims; an
 * opaque one gets it from the introspection response (§6.2: "the resource server
 * uses the data of the introspection response to validate the access token
 * binding itself locally"). Keying this off a locally-verified artifact instead
 * would silently skip the check for every DPoP-bound opaque token.
 *
 * The confirmation travels WITH the resolution, so only `htm`/`htu` are
 * transport-specific — which is what lets the socket handshake run the same
 * check as HTTP instead of its own.
 *
 * `Aegis.verifyDpopProof` does the proof-side work (signature over the embedded
 * `jwk`, thumbprint against `cnf.jkt`, the §7 `ath` hash of the presented token,
 * `iat` freshness, and the RFC 7515 §4.1.11 `crit` gate under `critical`); this
 * adds the request-side `htm`/`htu` comparison, which aegis cannot do because it
 * never sees the request.
 *
 * `critical` is DEPLOYMENT policy, not request material, which is why it travels
 * beside `DpopBinding` rather than inside it: every caller reads it from
 * `deploymentCritical`, so a route cannot widen what the deployment declared.
 * ⚠ REQUIRED, not optional — an optional parameter lets a call site omit it, and
 * the proof is then refused for an extension the deployment has declared.
 */
export const assertDpopBinding = (
  access: PylonResolvedAccess,
  binding: DpopBinding,
  critical: Array<string> | undefined,
): void => {
  const thumbprint = access.claims.confirmation?.thumbprint;

  if (!isString(thumbprint) || thumbprint.length === 0) {
    // Not DPoP-bound, so there is no binding to check — unless the credential
    // was presented under the DPoP scheme, which asserts a bound token.
    // Accepting an unbound token there would make `Authorization: DPoP <bearer
    // token>` a way to present a bearer token with no proof-of-possession at all.
    if (binding.scheme !== true) return;

    throw new ClientError("Access token is not DPoP bound", {
      status: ClientError.Status.Unauthorized,
      code: "token_not_dpop_bound",
      type: "urn:lindorm:pylon:error:token_not_dpop_bound",
      title: "Token Not DPoP Bound",
      details:
        "The request used the DPoP authorization scheme, but the access token carries no cnf.jkt confirmation thumbprint to bind the proof to",
      data: { provenance: access.provenance },
    });
  }

  if (!isString(binding.proof) || binding.proof.length === 0) {
    throw new ClientError("Missing DPoP proof", {
      status: ClientError.Status.Unauthorized,
      code: "missing_dpop_proof",
      type: "urn:lindorm:pylon:error:missing_dpop_proof",
      title: "Missing DPoP Proof",
      details:
        "The access token is DPoP bound (cnf.jkt), so the request must carry a matching DPoP proof",
      data: { provenance: access.provenance },
    });
  }

  // Scoped exactly like the access-token verify: everything reachable inside
  // `verifyDpopProof` is a verdict on the proof the caller presented (it carries
  // its own key, so there is no lookup and no I/O at all), and the crypto layer
  // beneath aegis throws its own error classes — so the conversion is by CALL,
  // not by a list of classes that the next curve package escapes.
  let proof;
  try {
    proof = Aegis.verifyDpopProof({
      proof: binding.proof,
      accessToken: access.token,
      expectedThumbprint: thumbprint,
      critical,
    });
  } catch (error: any) {
    throw new ClientError("Invalid DPoP proof", {
      error,
      status: ClientError.Status.Unauthorized,
      code: "invalid_dpop_proof",
      type: "urn:lindorm:pylon:error:invalid_dpop_proof",
      title: "Invalid DPoP Proof",
      details: error.message,
      data: { provenance: access.provenance },
    });
  }

  assertDpopMatch(
    { method: binding.htm, origin: binding.htu.origin, path: binding.htu.path },
    proof,
  );
};
