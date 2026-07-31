import type {
  AegisSignKey,
  SignedToken,
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
}): Promise<SignedToken> => {
  // `key`/`omit` are the aegis-side concerns; `rest` is exactly the kit's
  // `SignUnstructuredTokenOptions` envelope and rides the `RawSignCoseInput`
  // straight through to `CwsKit.sign`, so a new kit sign option threads through
  // with no change here.
  const { key, omit, ...rest } = options;

  return rawSignCose({
    input: { payload: data, key, omit, ...rest },
    deps,
  });
};
