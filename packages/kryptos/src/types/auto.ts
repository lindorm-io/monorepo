// default options

import type { Optional } from "@lindorm/types";
import type { KryptosAttributes } from "./attributes.js";
import type { KryptosCertificateOption } from "./certificate.js";
import type { RsaModulus } from "./key-types/index.js";
import type { KryptosOperation } from "./operation.js";

type Attributes = Omit<KryptosAttributes, "certificateChain" | "operations" | "use">;

export type KryptosAuto = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "curve"
  | "encryption"
  | "expiresAt"
  | "hidden"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "purpose"
  | "type"
> & {
  certificate?: KryptosCertificateOption;
  // Explicit RSA modulus (else derived from the algorithm) and explicit key_ops
  // (else derived from algorithm + use). Both are power-user overrides.
  modulus?: RsaModulus;
  operations?: Array<KryptosOperation>;
};
