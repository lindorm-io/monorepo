export type KryptosAlgorithm =
  // EC Keys
  | "ES256"
  | "ES384"
  | "ES512"

  // Oct Keys
  | "HS256"
  | "HS384"
  | "HS512"

  // OKP Keys
  | "EdDSA"
  | "ECDH-ES"

  // RSA Keys
  | "RS256"
  | "RS384"
  | "RS512";

export type KryptosCurve =
  // Nist
  | "P-256"
  | "P-384"
  | "P-521"

  // Specific
  | "secp256k1"
  | "secp384r1"
  | "secp521r1"

  // Octet
  | "Ed25519"
  | "X25519";

export type KryptosExportMode = "both" | "public";

export type KryptosFormat = "b64" | "der" | "jwk" | "pem" | "raw";

export type KryptosOperation =
  | "decrypt"
  | "deriveBits"
  | "deriveKey"
  | "encrypt"
  | "sign"
  | "unwrapKey"
  | "verify"
  | "wrapKey";

export type KryptosType = "EC" | "oct" | "OKP" | "RSA";

export type KryptosUse = "enc" | "sig";
