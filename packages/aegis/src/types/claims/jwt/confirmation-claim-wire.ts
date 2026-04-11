import { KryptosJwk } from "@lindorm/kryptos";

export type ConfirmationClaimWire = {
  jkt?: string;
  "x5t#S256"?: string;
  jwk?: KryptosJwk;
  kid?: string;
  jku?: string;
};
