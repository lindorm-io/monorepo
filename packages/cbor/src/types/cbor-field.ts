export type CborValueKind =
  | "text"
  | "int"
  | "date"
  | "bool"
  | "enum"
  | "bstr"
  | "bstrArray"
  | "bespoke";

export type CborField = {
  /** Domain key on the plain-object record. */
  key: string;

  /** Integer wire label. Must be > 0 — label 0 is reserved for the version tag. */
  label: number;

  kind: CborValueKind;

  /** REQUIRED when kind === "enum": maps a domain value to its integer wire code. */
  enum?: Record<string, number>;

  /**
   * For "bstr" / "bstrArray" only. When set, the domain value is a base64 STRING
   * (encoded/decoded with this alphabet); when unset, the domain value is a raw
   * Buffer / Uint8Array.
   */
  encoding?: "b64u" | "base64";

  /** REQUIRED when kind === "bespoke": domain value → wire value. */
  encode?: (value: unknown) => unknown;

  /** REQUIRED when kind === "bespoke": wire value → domain value. */
  decode?: (value: unknown) => unknown;
};

export type CborSpec = {
  /** Auto-written on encode; validated on decode (throws on mismatch). */
  version?: { label: number; value: number };
  fields: ReadonlyArray<CborField>;
};

/** The table IS the construction Settings. */
export type CborKitSettings = CborSpec;
