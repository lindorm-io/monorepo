import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "../options";

type Attributes = Omit<KryptosAttributes, "algorithm" | "type" | "use">;

type Std = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "curve"
  | "encryption"
  | "expiresAt"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "operations"
  | "ownerId"
  | "updatedAt"
>;

type Req = Pick<KryptosAttributes, "algorithm" | "type" | "use">;

export type KryptosMake = Std & Req;
