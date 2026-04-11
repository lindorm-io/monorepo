import { ClientError } from "@lindorm/errors";
import { normalizeHtu } from "../normalize-htu";

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
      details: "DPoP proof htm does not match request method",
      debug: { proof: proof.httpMethod, request: target.method },
      status: ClientError.Status.Unauthorized,
    });
  }

  const expected = normalizeHtu(target.origin, target.path);
  const actual = normalizeHtu(proof.httpUri, "");

  if (actual !== expected) {
    throw new ClientError("Invalid DPoP proof", {
      details: "DPoP proof htu does not match request URI",
      debug: { proof: actual, request: expected },
      status: ClientError.Status.Unauthorized,
    });
  }
};
