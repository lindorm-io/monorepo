import type { Dict } from "@lindorm/types";
import { type CompactSpec, compactDecode, compactEncode } from "./compact-map.js";

/**
 * Compact COSE encoding for a `sub_id` (RFC 9493 Subject Identifier). Reuses the
 * CWT labels for iss(1)/sub(2) and adds lindorm labels for `format` and the
 * other format-specific members; the `aliases` format's `identifiers` array
 * recurses.
 *
 * Proprietary (smaller) form, emitted by default; the interoperable string-keyed
 * object is emitted when a mint sets `proprietary: false`. Members outside the
 * registered RFC 9493 formats are not carried in the compact form.
 */
const SUBID_SPEC: CompactSpec = {
  labels: {
    format: 0,
    iss: 1,
    sub: 2,
    email: 4,
    phone_number: 5,
    uri: 6,
    url: 7,
    id: 8,
    identifiers: 9,
  },
  nested: { identifiers: { array: true, spec: () => SUBID_SPEC } },
};

export const encodeSubIdCompact = (subId: Dict): Map<number, unknown> =>
  compactEncode(subId, SUBID_SPEC);

export const decodeSubIdCompact = (map: Map<number, unknown>): Dict =>
  compactDecode(map, SUBID_SPEC);
