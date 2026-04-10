import { ClientError } from "@lindorm/errors";
import { PylonHttpContext } from "../../types";
import { normalizeHtu } from "./normalize-htu";

type DpopRequestClaims = {
  httpMethod: string;
  httpUri: string;
};

export const assertDpopRequestMatch = (
  ctx: PylonHttpContext,
  dpop: DpopRequestClaims,
): void => {
  if (dpop.httpMethod !== ctx.method) {
    throw new ClientError("Invalid DPoP proof", {
      details: "DPoP proof htm does not match request method",
      debug: { proof: dpop.httpMethod, request: ctx.method },
      status: ClientError.Status.Unauthorized,
    });
  }

  const expected = normalizeHtu(ctx.origin, ctx.path);
  const actual = normalizeHtu(dpop.httpUri, "");

  if (actual !== expected) {
    throw new ClientError("Invalid DPoP proof", {
      details: "DPoP proof htu does not match request URI",
      debug: { proof: actual, request: expected },
      status: ClientError.Status.Unauthorized,
    });
  }
};
