import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "../attributes";

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
  | "purpose"
  | "updatedAt"
>;

type Req = Pick<KryptosAttributes, "algorithm" | "type" | "use">;

export type KryptosGenerate = Std & Req;
