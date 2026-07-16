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

  /**
   * Wire label — the CBOR map key.
   * - A nonzero integer (0 is reserved for the version tag); negatives are legal
   *   (e.g. COSE private-use labels).
   * - A string, only when the spec sets `labels: "mixed"` (e.g. a short COSE
   *   claim keyed by its JOSE name).
   */
  label: number | string;

  /**
   * Marks a field whose compact integer `label` degrades off-platform: on-platform
   * (encode default) it keys by `label`; when `encode(value, { proprietary: false })`
   * it keys by `key` instead (the interoperable string). Requires an integer `label`.
   */
  proprietary?: boolean;

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

  /**
   * How decode treats a wire label with no matching field.
   * - "strict" (default): throw — the format is closed, an unknown label is corruption.
   * - "lax": preserve it verbatim under its wire key (forward-compat passthrough).
   */
  mode?: "strict" | "lax";

  /**
   * Which label types the spec's fields may declare.
   * - "int" (default): integer labels only — a string label is a config error.
   * - "mixed": integer OR string labels (e.g. COSE claims that key by their JOSE
   *   string name where no registered integer label exists).
   *
   * Orthogonal to `mode`: `labels` gates spec construction, `mode` gates decode.
   */
  labels?: "int" | "mixed";

  fields: ReadonlyArray<CborField>;
};

/** The table IS the construction Settings. */
export type CborKitSettings = CborSpec;

/** Per-call encode options. */
export type CborEncodeOptions = {
  /**
   * Emit compact proprietary integer labels (default `true`). When `false`, every
   * `proprietary` field degrades to its string `key` instead of its integer `label`
   * — the interoperable, off-platform wire form. Non-proprietary fields are unaffected.
   */
  proprietary?: boolean;
};
