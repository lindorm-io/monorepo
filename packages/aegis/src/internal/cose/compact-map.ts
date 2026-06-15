import type { Dict } from "@lindorm/types";

/**
 * A spec for compacting a fixed-member object to an integer-keyed CBOR map and
 * back. `labels` maps each known field to its integer label; `nested` declares
 * fields that are themselves compacted (recursively), optionally as an array.
 *
 * Used for the proprietary (smaller) COSE encoding of the structured claims with
 * a fixed member set — `act`/`mayAct` (RFC 8693) and `sub_id` (RFC 9493).
 * Unknown members are dropped (the interoperable string-keyed form preserves
 * everything; this compact form is opt-out via `proprietary: false`).
 */
export type CompactSpec = {
  labels: Readonly<Record<string, number>>;
  nested?: Readonly<Record<string, { array?: boolean; spec: () => CompactSpec }>>;
};

export const compactEncode = (obj: Dict, spec: CompactSpec): Map<number, unknown> => {
  const map = new Map<number, unknown>();

  for (const [field, label] of Object.entries(spec.labels)) {
    const value = obj[field];
    if (value === undefined) continue;

    const nested = spec.nested?.[field];
    if (nested) {
      const childSpec = nested.spec();
      map.set(
        label,
        nested.array && Array.isArray(value)
          ? value.map((item) => compactEncode(item as Dict, childSpec))
          : compactEncode(value as Dict, childSpec),
      );
    } else {
      map.set(label, value);
    }
  }

  return map;
};

export const compactDecode = (map: Map<number, unknown>, spec: CompactSpec): Dict => {
  const reverse = new Map<number, string>(
    Object.entries(spec.labels).map(([field, label]) => [label, field]),
  );

  const obj: Dict = {};
  for (const [label, value] of map) {
    const field = reverse.get(label);
    if (field === undefined) continue;

    const nested = spec.nested?.[field];
    if (nested) {
      const childSpec = nested.spec();
      obj[field] =
        nested.array && Array.isArray(value)
          ? value.map((item) =>
              item instanceof Map ? compactDecode(item, childSpec) : item,
            )
          : value instanceof Map
            ? compactDecode(value, childSpec)
            : value;
    } else {
      obj[field] = value;
    }
  }

  return obj;
};
