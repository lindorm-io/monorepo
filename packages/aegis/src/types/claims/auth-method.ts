// RFC 8176 — Authentication Method Reference (AMR) values for the `amr`
// claim (OIDC Core §2). The list mirrors the IANA AMR Values registry as
// of RFC 8176. Open-ended via (string & {}) so deployments can use
// custom AMRs (e.g. vendor-specific factors) without losing autocomplete
// on the standard set.
//
// https://www.rfc-editor.org/rfc/rfc8176
export type AuthMethod =
  | "face" // Biometric using facial recognition
  | "fpt" // Biometric using a fingerprint
  | "geo" // Use of geolocation information
  | "hwk" // Proof-of-possession of a hardware-secured key
  | "iris" // Biometric using iris scan
  | "kba" // Knowledge-based authentication
  | "mca" // Multiple-channel authentication
  | "mfa" // Multiple-factor authentication
  | "otp" // One-time password
  | "pin" // Personal Identification Number
  | "pop" // Proof-of-possession of a key
  | "pwd" // Password-based authentication
  | "rba" // Risk-based authentication
  | "retina" // Biometric using retina scan
  | "sc" // Smart card
  | "sms" // Confirmation using SMS message
  | "swk" // Proof-of-possession of a software-secured key
  | "tel" // Confirmation via telephone call
  | "user" // User presence test
  | "vbm" // Biometric using voice
  | "wia" // Windows integrated authentication
  | (string & {});
