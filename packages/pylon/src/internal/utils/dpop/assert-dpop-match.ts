import { ClientError } from "@lindorm/errors";
import { normalizeHtu } from "../normalize-htu.js";

export type DpopProofClaims = {
  httpMethod: string;
  httpUri: string;
};

export type DpopMatchTarget = {
  method: string;
  origin: string;
  path: string;
};

export const assertDpopMatch = (
  target: DpopMatchTarget,
  proof: DpopProofClaims,
): void => {
  if (proof.httpMethod !== target.method) {
    throw new ClientError("Invalid DPoP proof", {
      code: "dpop_htm_mismatch",
      title: "DPoP HTM Mismatch",
      type: "urn:lindorm:pylon:error:dpop_htm_mismatch",
      details: "DPoP proof htm does not match request method",
      data: { proof: proof.httpMethod, request: target.method },
      status: ClientError.Status.Unauthorized,
    });
  }

  const expected = normalizeHtu(target.origin, target.path);
  const actual = normalizeHtu(proof.httpUri, "");

  if (actual !== expected) {
    throw new ClientError("Invalid DPoP proof", {
      code: "dpop_htu_mismatch",
      title: "DPoP HTU Mismatch",
      type: "urn:lindorm:pylon:error:dpop_htu_mismatch",
      details: "DPoP proof htu does not match request URI",
      data: { proof: actual, request: expected },
      status: ClientError.Status.Unauthorized,
    });
  }
};
