import { Optional } from "@lindorm/types";
import { KryptosOptions } from "./kryptos";

type Omitted = Omit<KryptosOptions, "privateKey" | "publicKey" | "type">;

export type KryptosClone = Optional<
  Omitted,
  "algorithm" | "expiresAt" | "issuer" | "operations" | "use"
>;
