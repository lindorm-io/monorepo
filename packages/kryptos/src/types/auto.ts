// default options

import type { Optional } from "@lindorm/types";
import type { KryptosAttributes } from "./attributes.js";
import type { KryptosCertificateOption } from "./certificate.js";
import type { RsaModulus } from "./key-types/index.js";

type Attributes = Omit<KryptosAttributes, "certificateChain" | "use">;

export type KryptosAuto = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "curve"
  | "encryption"
  | "expiresAt"
  | "internal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "publish"
  | "purpose"
  | "type"
> & {
  certificate?: KryptosCertificateOption;
  // Explicit RSA modulus (else derived from the algorithm) — a power-user
  // override.
  modulus?: RsaModulus;
};
