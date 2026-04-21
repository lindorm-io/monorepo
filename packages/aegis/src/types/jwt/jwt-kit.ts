import type { SignKitOptions } from "../kit.js";

export type JwtKitOptions = SignKitOptions & {
  clockTolerance?: number;
  dpopMaxSkew?: number;
  issuer?: string;
};
