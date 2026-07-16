import type { CborField } from "../../types/cbor-field.js";

export type ResolvedCborField = CborField & {
  /** Reverse of `enum` (int wire code → domain value); present only for kind === "enum". */
  reverseEnum?: Record<number, string>;
};

export type ResolvedCborSpec = {
  version?: { label: number; value: number };
  fields: ReadonlyArray<ResolvedCborField>;
  /** Wire label → field, for decode lookup. */
  byLabel: Map<number, ResolvedCborField>;
};
