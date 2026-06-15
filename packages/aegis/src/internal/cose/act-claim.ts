import type { Dict } from "@lindorm/types";
import { type CompactSpec, compactDecode, compactEncode } from "./compact-map.js";

/**
 * Compact COSE encoding for the `act`/`mayAct` actor chain (RFC 8693). Reuses
 * the CWT labels for the standard members (iss=1, sub=2, aud=3) and adds lindorm
 * labels for the members CWT does not register (client_id=4, nested act=5).
 *
 * This is the PROPRIETARY (smaller) form, emitted by default; the interoperable
 * string-keyed object is emitted when a mint sets `proprietary: false`.
 */
const ACT_SPEC: CompactSpec = {
  labels: { issuer: 1, subject: 2, audience: 3, clientId: 4, act: 5 },
  nested: { act: { spec: () => ACT_SPEC } },
};

export const encodeActCompact = (actor: Dict): Map<number, unknown> =>
  compactEncode(actor, ACT_SPEC);

export const decodeActCompact = (map: Map<number, unknown>): Dict =>
  compactDecode(map, ACT_SPEC);
