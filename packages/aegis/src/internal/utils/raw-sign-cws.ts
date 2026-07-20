import type { CwsContent, SignCwsOptions, SignedCws } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { rawSignCose } from "./raw-sign-cose.js";

/**
 * The raw CWS sign namespace (`aegis.cws.sign`) — the raw COSE_Sign1 mirror of
 * `jws.sign`. Reuses the SAME raw COSE signer the `sign({ format: "cws" })`
 * mechanism dispatches to (`rawSignCose`); the namespace is the ergonomic surface
 * over it (as `jws` coexists with `sign`).
 */
export const rawSignCws = ({
  data,
  options = {},
  deps,
}: {
  data: CwsContent;
  options?: SignCwsOptions;
  deps: AegisDeps;
}): Promise<SignedCws> =>
  rawSignCose({
    input: {
      payload: data,
      key: options.key,
      objectId: options.objectId,
      omit: options.omit,
      tokenType: options.tokenType,
    },
    deps,
  });
