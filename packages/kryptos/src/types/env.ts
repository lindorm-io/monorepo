// Wire format for `toEnvString` / `KryptosKit.env.export`. CBOR is the compact
// default; JSON is the opt-in human-readable form. Both are carried under the
// single `kryptos:` prefix and auto-detected on import.
export type KryptosEnvFormat = "cbor" | "json";
