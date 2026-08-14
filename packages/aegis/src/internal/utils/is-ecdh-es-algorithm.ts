import { ECDH_ES_ALGORITHMS } from "@lindorm/kryptos";

/**
 * RFC 7518 §4.6 — the apu/apv Concat-KDF OtherInfo is meaningful ONLY for the
 * ECDH-ES key-management family (direct + the `+A*KW` variants).
 *
 * It is asked TWICE on the JWE read path, for two different reasons: to decide
 * whether the party info is decoded at all ({@link resolveEcdhParty}) and to
 * decide whether a recipient-identity mismatch is even a question
 * (`verifyPartyBinding` — recipient addressing is an ECDH-ES concept). The second
 * caller reads it standalone, which is why it is its own predicate.
 */
export const isEcdhEsAlgorithm = (algorithm: string): boolean =>
  (ECDH_ES_ALGORITHMS as ReadonlyArray<string>).includes(algorithm);
