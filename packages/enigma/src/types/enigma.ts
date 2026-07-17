import type { AesKitSettings } from "@lindorm/aes";
import type { OctKitSettings } from "@lindorm/oct";
import type { ArgonKitSettings } from "./argon-kit.js";

export type EnigmaSettings = {
  aes: AesKitSettings;
  argon?: ArgonKitSettings;
  oct: OctKitSettings;
};
