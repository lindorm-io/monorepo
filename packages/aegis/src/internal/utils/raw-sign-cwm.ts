import type { Dict } from "@lindorm/types";
import { CwmKit } from "../../classes/CwmKit.js";
import type {
  AegisSignKey,
  CwtClaimsWire,
  SignStructuredTokenOptions,
  SignedToken,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedCwt } from "./cwt-payload.js";

/**
 * The raw CWM sign namespace (`aegis.cwm.sign`) — the COSE_Mac0 (symmetric) twin
 * of `aegis.cwt.sign`. Identical transform-free wire assembly; only the integrity
 * structure differs (a MAC, not a signature). A CWM shares the CWT media type
 * (`application/cwt` / `+cwt`) — the STRUCTURE (Mac0 vs Sign1) is what tells `cwm`
 * apart from `cwt` (D6). A symmetric key is required; an asymmetric one throws via
 * the kit gate (that is `aegis.cwt.sign`).
 */
export const rawSignCwm = async <C extends Dict = Dict>({
  claims,
  options = {},
  deps,
}: {
  claims: CwtClaimsWire & C;
  options?: SignStructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  // `key` is the aegis-only signing-key selector (resolves the kryptos); every
  // other field IS the kit's `SignStructuredTokenOptions` and is forwarded
  // structurally, so a new sign option threads through with no change here.
  const { key, ...rest } = options;

  const kryptos = await deps.resolveSignKey({ key });

  const token = new CwmKit({ kryptos, logger: deps.logger }).sign<C>(claims, rest);

  return buildSignedCwt(token.toString("base64url"), claims, rest.header?.oid, "cwm");
};
