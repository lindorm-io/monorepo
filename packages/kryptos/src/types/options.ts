import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { RsaModulus } from "./key-types";

type StdOptions = Optional<
  KryptosAttributes,
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
  | "operations"
  | "ownerId"
  | "purpose"
  | "updatedAt"
>;

export type KryptosKeys = {
  privateKey?: Buffer;
  publicKey?: Buffer;
};

export type KryptosOptions = StdOptions &
  KryptosKeys & {
    modulus?: RsaModulus | null;
  };
