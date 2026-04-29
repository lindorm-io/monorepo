import type { PylonHttpContext } from "../../../types/index.js";
import { assertDpopMatch, type DpopProofClaims } from "./assert-dpop-match.js";

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
