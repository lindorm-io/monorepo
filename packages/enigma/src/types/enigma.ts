import type { AesKitOptions } from "@lindorm/aes";
import type { OctKitOptions } from "@lindorm/oct";
import type { ArgonKitOptions } from "./argon-kit.js";

export type EnigmaOptions = {
  aes: AesKitOptions;
  argon?: ArgonKitOptions;
  oct: OctKitOptions;
};
