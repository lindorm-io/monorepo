// default options

import type { Optional } from "@lindorm/types";
import type { KryptosAttributes } from "./attributes.js";
import type { KryptosCertificateOption } from "./certificate.js";

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
> & { certificate?: KryptosCertificateOption };
