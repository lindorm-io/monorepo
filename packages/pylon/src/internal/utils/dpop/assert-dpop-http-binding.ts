import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { PylonHttpContext, PylonResolvedAccess } from "../../../types/index.js";
import { assertDpopHttpRequestMatch } from "./assert-dpop-http-request-match.js";

export type DpopHttpBinding = {
  /** The raw `DPoP` request header, when one was sent. */
  proof: string | undefined;
  /** True when the request authenticated with the `DPoP` scheme (RFC 9449 §7.1). */
  scheme: boolean;
};

/**
 * The RFC 9449 §7.1 resource-server binding check, driven by `(proof, cnf.jkt,
 * token)` — the three things available on BOTH credential paths. A locally
 * verified JWT carries `cnf.jkt` in its own claims; an opaque token gets it from
 * the introspection response (§6.2: "the resource server uses the data of the
 * introspection response to validate the access token binding itself locally").
 * Keying this off a locally-verified artifact instead would silently skip the
 * check for every DPoP-bound opaque token.
 *
 * `Aegis.verifyDpopProof` does the proof-side work (signature over the embedded
 * `jwk`, thumbprint against `cnf.jkt`, the §7 `ath` hash of the presented token,
 * `iat` freshness); this adds the request-side `htm`/`htu` comparison, which
 * aegis cannot do because it never sees the HTTP request.
 */
export const assertDpopHttpBinding = (
  ctx: PylonHttpContext,
  access: PylonResolvedAccess,
  binding: DpopHttpBinding,
): void => {
  const thumbprint = access.claims.confirmation?.thumbprint;

  if (!isString(thumbprint) || thumbprint.length === 0) {
    // Not DPoP-bound, so there is no binding to check — unless the request used
    // the DPoP authorization scheme, which asserts a bound token. Accepting an
    // unbound token there would make `Authorization: DPoP <bearer token>` a way
    // to present a bearer token with no proof-of-possession at all.
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
        "The access token is DPoP bound (cnf.jkt), so the request must carry a matching DPoP proof header",
      data: { provenance: access.provenance },
    });
  }

  assertDpopHttpRequestMatch(
    ctx,
    Aegis.verifyDpopProof({
      proof: binding.proof,
      accessToken: access.token,
      expectedThumbprint: thumbprint,
    }),
  );
};
