import type { AesKitSettings } from "@lindorm/aes";
import type { OctKitOptions } from "@lindorm/oct";
import type { ArgonKitOptions } from "./argon-kit.js";

export type EnigmaOptions = {
  aes: AesKitSettings;
  argon?: ArgonKitOptions;
  oct: OctKitOptions;
};
