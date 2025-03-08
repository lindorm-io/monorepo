// default options

import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";

type Attributes = Omit<KryptosAttributes, "curve" | "operations" | "type" | "use">;

export type KryptosAuto = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "encryption"
  | "expiresAt"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "purpose"
  | "updatedAt"
>;
