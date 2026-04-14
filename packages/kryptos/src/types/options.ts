import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { RsaModulus } from "./key-types";

type StdOptions = Optional<
  Omit<KryptosAttributes, "certificateChain" | "certificateThumbprint">,
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
