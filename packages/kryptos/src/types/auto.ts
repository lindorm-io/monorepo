// default options

import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./options";

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
  | "updatedAt"
>;
