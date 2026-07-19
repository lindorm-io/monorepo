import type { Dict } from "@lindorm/types";
import { type CompactSpec, compactDecode, compactEncode } from "./compact-map.js";

/**
 * Compact COSE encoding for the `act`/`mayAct` actor chain (RFC 8693). Reuses
 * the CWT labels for the standard members (iss=1, sub=2, aud=3) and adds lindorm
 * labels for the members CWT does not register (client_id=4, nested act=5).
 *
 * Since Phase 5 the translator (`domainToCose`) delivers the WIRE act shape
 * (`sub`/`iss`/`aud`/`client_id`, RFC 8693 member names), so the labels key by
 * those wire names — NOT the domain names (`subject`/`issuer`/…). The compact
 * on-platform bytes are unchanged (same labels, same values); the interoperable
 * `proprietary: false` object now carries the RFC 8693 wire member names (a stock
 * verifier's vocabulary) rather than the lindorm domain names it used before.
 *
 * This is the PROPRIETARY (smaller) form, emitted by default; the interoperable
 * string-keyed object is emitted when a mint sets `proprietary: false`.
 */
const ACT_SPEC: CompactSpec = {
  labels: { iss: 1, sub: 2, aud: 3, client_id: 4, act: 5 },
  nested: { act: { spec: () => ACT_SPEC } },
};

export const encodeActCompact = (actor: Dict): Map<number, unknown> =>
  compactEncode(actor, ACT_SPEC);

export const decodeActCompact = (map: Map<number, unknown>): Dict =>
  compactDecode(map, ACT_SPEC);
