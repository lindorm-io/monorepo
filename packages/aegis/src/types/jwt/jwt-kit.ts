import { SignKitOptions } from "../kit";

export type JwtKitOptions = SignKitOptions & {
  clockTolerance?: number;
  dpopMaxSkew?: number;
  issuer?: string;
};
