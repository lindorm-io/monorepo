import { KeySetType } from "@lindorm-io/jwk";

export type JwtOptions = {
  clockTolerance?: number; // number of seconds to tolerate when checking the nbf and exp claims
  issuer: string;
  jwksUrl?: string;
  keyType?: KeySetType;
};
