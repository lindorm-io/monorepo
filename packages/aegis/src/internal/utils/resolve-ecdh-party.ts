import { B64 } from "@lindorm/b64";
import { B64U } from "../constants/format.js";
import { isEcdhEsAlgorithm } from "./is-ecdh-es-algorithm.js";

/** The ECDH-ES party info, resolved for one algorithm. */
export type ResolvedEcdhParty = {
  /** The base64url apu, or `undefined` when the algorithm has no use for one. */
  partyProducer: string | undefined;
  /** The base64url apv, or `undefined` when the algorithm has no use for one. */
  partyRecipient: string | undefined;
  /** The decoded apu the Concat-KDF consumes. */
  apu: Buffer | undefined;
  /** The decoded apv the Concat-KDF consumes. */
  apv: Buffer | undefined;
};

/**
 * Gate and decode the ECDH-ES party info for one algorithm — the ONE reading of
 * RFC 7518 §4.6 both JWE directions use.
 *
 * For an ECDH-ES algorithm the base64url apu/apv are decoded into the bytes the
 * Concat-KDF consumes; for every other algorithm they are stripped, because
 * nothing downstream would read them and emitting them would claim a binding the
 * key agreement never made.
 */
export const resolveEcdhParty = (
  algorithm: string,
  party: { partyProducer?: string; partyRecipient?: string },
): ResolvedEcdhParty => {
  const ecdhEs = isEcdhEsAlgorithm(algorithm);

  const partyProducer = ecdhEs ? party.partyProducer : undefined;
  const partyRecipient = ecdhEs ? party.partyRecipient : undefined;

  return {
    partyProducer,
    partyRecipient,
    // ⚠ THE GATE IS WHAT KEEPS THIS DECODE SAFE. Decoded ungated, a crafted
    // non-ECDH-ES header carrying a non-base64 `apu` reaches `B64.toBuffer`
    // (`Uint8Array.fromBase64`, no guard) and a raw `SyntaxError` escapes
    // `JweKit.decrypt`. Stripped first, the read fails in the AES layer under a
    // proper aegis error. Pinned by JweKit.test.ts.
    apu: partyProducer ? B64.toBuffer(partyProducer, B64U) : undefined,
    apv: partyRecipient ? B64.toBuffer(partyRecipient, B64U) : undefined,
  };
};
