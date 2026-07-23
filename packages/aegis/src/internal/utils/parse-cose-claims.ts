import type { Dict } from "@lindorm/types";
import type { ParsedToken } from "../../types/index.js";
import { decodeCwt, decodeCwtWire } from "../cose/cwt-token.js";
import { buildCoseVerifiedToken } from "./build-cose-verified-token.js";

/**
 * The keyless, UNVERIFIED parse of a claims-bearing COSE token — a CWT
 * (COSE_Sign1) or a CWM (COSE_Mac0). Decodes the header triple + the wire claims
 * map WITHOUT checking the signature/MAC, then reuses the shared
 * {@link buildCoseVerifiedToken} plumbing to split the wire into the domain
 * `claims`/`custom`/`profile` buckets and report `cwt` vs `cwm` from the COSE
 * structure tag. The COSE twin of `parseJwtToDomain`. `encrypted: false` (a bare
 * CWT/CWM is not encrypted), so sensitive claims are suppressed (§13.3), and no
 * `dpop` (a verify-only field) is ever populated.
 */
export const parseCoseClaimsToDomain = <C extends Dict = Dict>(
  token: string,
  bytes: Buffer,
): ParsedToken<C> => {
  const decoded = decodeCwt(bytes);
  const { payload } = decodeCwtWire(bytes);

  return buildCoseVerifiedToken({
    wire: payload,
    decoded,
    token,
    encrypted: false,
  }) as ParsedToken<C>;
};
