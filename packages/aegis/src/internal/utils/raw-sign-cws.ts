import type {
  AegisSignKey,
  SignedCwt,
  SignUnstructuredTokenOptions,
  TokenContent,
} from "../../types/index.js";
import type { OmitMode } from "./apply-omit.js";
import type { AegisDeps } from "./aegis-deps.js";
import { rawSignCose } from "./raw-sign-cose.js";

/**
 * The raw CWS sign namespace (`aegis.cws.sign`) — the raw COSE_Sign1 mirror of
 * `jws.sign`. Reuses the SAME raw COSE signer the `sign({ format: "cws" })`
 * mechanism dispatches to (`rawSignCose`); the namespace is the ergonomic surface
 * over it (as `jws` coexists with `sign`). Its `tokenType` is already the bare
 * kit PREFIX (kit-tier options); it passes straight through.
 */
export const rawSignCws = ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: SignUnstructuredTokenOptions & { key?: AegisSignKey; omit?: OmitMode };
  deps: AegisDeps;
}): Promise<SignedCwt> =>
  rawSignCose({
    input: {
      payload: data,
      key: options.key,
      omit: options.omit,
      tokenType: options.tokenType,
      header: options.header,
    },
    deps,
  });
