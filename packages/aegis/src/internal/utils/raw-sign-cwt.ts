import type { Dict } from "@lindorm/types";
import { CwtKit } from "../../classes/CwtKit.js";
import type {
  AegisSignKey,
  CwtClaimsWire,
  SignStructuredTokenOptions,
  SignedToken,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { coseName } from "../claims/claims-registry.js";
import { buildSignedToken } from "./build-signed-token.js";

/**
 * The raw CWT sign namespace (`aegis.cwt.sign`) — the generic-CWT mirror of the
 * generic `jwt.sign`. Resolve the signing key, then serialize the ALREADY-WIRE
 * `CwtClaimsWire` (COSE-name-keyed: `iss`/`sub`/`exp`/`cti`) verbatim via the
 * transform-free `CwtKit` (R18) — no domain translation, no envelope
 * auto-injection. The domain sign path is `aegis.mint`.
 *
 * The raw `cwt` namespace is COSE_Sign1 (asymmetric); a symmetric key throws via
 * the kit gate — the symmetric COSE_Mac0 twin is the `cwm` namespace.
 */
export const rawSignCwt = async <C extends Dict = Dict>({
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

  const token = new CwtKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).sign<C>(claims, rest);

  return buildSignedToken(
    token.toString("base64url"),
    claims,
    rest.header?.oid,
    "cwt",
    coseName,
  );
};
