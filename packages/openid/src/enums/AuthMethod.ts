/**
 * Authentication Method Reference (AMR) values for the `amr` claim
 * (OIDC Core §2). Mirrors the IANA AMR Values registry as of RFC 8176.
 *
 * The runtime object is the SINGLE SOURCE — the type is derived from it, so a
 * value and its type can never drift apart. Consumable at runtime (e.g. a
 * proteus `@Enum` column) as well as in type position.
 *
 * The type stays OPEN (`| (string & {})`) so a deployment can use custom AMRs
 * (e.g. vendor-specific factors) without losing autocomplete on the standard
 * set — RFC 8176 §1 explicitly anticipates values beyond the registry.
 *
 * https://www.rfc-editor.org/rfc/rfc8176
 */
export const AuthMethod = {
  /** wire: `face` — biometric using facial recognition */
  Face: "face",
  /** wire: `fpt` — biometric using a fingerprint */
  Fingerprint: "fpt",
  /** wire: `geo` — use of geolocation information */
  GeoLocation: "geo",
  /** wire: `hwk` — proof-of-possession of a hardware-secured key */
  HardwareKey: "hwk",
  /** wire: `iris` — biometric using iris scan */
  Iris: "iris",
  /** wire: `kba` — knowledge-based authentication */
  KnowledgeBased: "kba",
  /** wire: `mca` — multiple-channel authentication */
  MultipleChannel: "mca",
  /** wire: `mfa` — multiple-factor authentication */
  MultipleFactor: "mfa",
  /** wire: `otp` — one-time password */
  OneTimePassword: "otp",
  /** wire: `pin` — personal identification number */
  Pin: "pin",
  /** wire: `pop` — proof-of-possession of a key */
  ProofOfPossession: "pop",
  /** wire: `pwd` — password-based authentication */
  Password: "pwd",
  /** wire: `rba` — risk-based authentication */
  RiskBased: "rba",
  /** wire: `retina` — biometric using retina scan */
  Retina: "retina",
  /** wire: `sc` — smart card */
  SmartCard: "sc",
  /** wire: `sms` — confirmation using SMS message */
  Sms: "sms",
  /** wire: `swk` — proof-of-possession of a software-secured key */
  SoftwareKey: "swk",
  /** wire: `tel` — confirmation via telephone call */
  Telephone: "tel",
  /** wire: `user` — user presence test */
  UserPresence: "user",
  /** wire: `vbm` — biometric using voice */
  Voice: "vbm",
  /** wire: `wia` — windows integrated authentication */
  WindowsIntegrated: "wia",
} as const;

export type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod] | (string & {});
