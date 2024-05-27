export type JwksEncryptionAlgorithm =
  | "dir"
  | "A128KW"
  | "A192KW"
  | "A256KW"
  | "A128GCMKW"
  | "A192GCMKW"
  | "A256GCMKW"
  | "ECDH-ES"
  | "ECDH-ES+A128KW"
  | "ECDH-ES+A192KW"
  | "ECDH-ES+A256KW"
  | "ECDH-ES+A128GCMKW"
  | "ECDH-ES+A192GCMKW"
  | "ECDH-ES+A256GCMKW"
  | "PBES2-HS256+A128KW"
  | "PBES2-HS384+A192KW"
  | "PBES2-HS512+A256KW"
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512";

export type JwksSigningAlgorithm =
  | "EdDSA"
  | "ES256"
  | "ES384"
  | "ES512"
  | "HS256"
  | "HS384"
  | "HS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "RS256"
  | "RS384"
  | "RS512";

export type JwksAlgorithm = JwksEncryptionAlgorithm | JwksSigningAlgorithm;
