import type { Optional } from "@lindorm/types";
import type { KryptosAttributes } from "../../types/attributes.js";
import type { KryptosCertificateOption } from "../../types/certificate.js";
import type { RsaModulus } from "../../types/key-types/index.js";

type Attributes = Omit<
  KryptosAttributes,
  "algorithm" | "certificateChain" | "type" | "use"
>;

type Std = Optional<
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
  | "operations"
  | "ownerId"
  | "purpose"
>;

type Req = Pick<KryptosAttributes, "algorithm" | "type" | "use">;

export type KryptosGenerate = Std &
  Req & { certificate?: KryptosCertificateOption; modulus?: RsaModulus };
