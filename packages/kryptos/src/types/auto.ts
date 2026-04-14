// default options

import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { KryptosCertificateOption } from "./certificate";

type Attributes = Omit<
  KryptosAttributes,
  "certificateChain" | "curve" | "operations" | "type" | "use"
>;

export type KryptosAuto = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "encryption"
  | "expiresAt"
  | "hidden"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "purpose"
> & { certificate?: KryptosCertificateOption };
