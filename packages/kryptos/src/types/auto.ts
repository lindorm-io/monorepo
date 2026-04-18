// default options

import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { KryptosCertificateOption } from "./certificate";

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
