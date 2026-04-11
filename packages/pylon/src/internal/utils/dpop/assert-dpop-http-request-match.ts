import { PylonHttpContext } from "../../../types";
import { assertDpopMatch, DpopProofClaims } from "./assert-dpop-match";

export const assertDpopHttpRequestMatch = (
  ctx: PylonHttpContext,
  proof: DpopProofClaims,
): void => {
  assertDpopMatch(
    {
      method: ctx.method,
      origin: ctx.origin,
      path: ctx.path,
    },
    proof,
  );
};
