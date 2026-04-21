import type { Optional } from "@lindorm/types";
import type { KryptosAttributes } from "./attributes.js";
import type { RsaModulus } from "./key-types/index.js";

type StdOptions = Optional<
  Omit<KryptosAttributes, "certificateChain">,
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
>;

export type KryptosKeys = {
  privateKey?: Buffer;
  publicKey?: Buffer;
};

export type KryptosOptions = StdOptions &
  KryptosKeys & {
    certificateChain?: string | Array<string> | null;
    modulus?: RsaModulus | null;
  };
