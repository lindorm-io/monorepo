import type { SignKitSettings } from "../kit.js";

export type JwtKitSettings = SignKitSettings & {
  clockTolerance?: number;
  dpopMaxSkew?: number;
  issuer?: string;
};
