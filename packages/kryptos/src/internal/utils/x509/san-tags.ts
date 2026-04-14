export type SanType = "email" | "dns" | "uri" | "ip";

// SubjectAltName GeneralName context-specific implicit tag bytes per RFC 5280 §4.2.1.6.
// Email = [1], DNS = [2], URI = [6], IP = [7] — encoded as primitive context-class
// (0x80 base | tag number).
export const SAN_TAG_EMAIL = 0x81;
export const SAN_TAG_DNS = 0x82;
export const SAN_TAG_URI = 0x86;
export const SAN_TAG_IP = 0x87;

// Tag-number form (without the 0x80 context-class base) — used by encodeImplicitTag,
// which OR's in the context-class bit itself.
export const SAN_TAG_NUMBER_BY_TYPE: Record<Exclude<SanType, "ip">, number> = {
  email: 1,
  dns: 2,
  uri: 6,
};

export const SAN_IP_TAG_NUMBER = 7;

// Reverse map for parsers: full tag byte → SAN type.
export const SAN_TYPE_BY_TAG: Record<number, SanType> = {
  [SAN_TAG_EMAIL]: "email",
  [SAN_TAG_DNS]: "dns",
  [SAN_TAG_URI]: "uri",
  [SAN_TAG_IP]: "ip",
};
