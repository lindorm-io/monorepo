import { AesKitOptions } from "@lindorm/aes";
import { OctKitOptions } from "@lindorm/oct";
import { ArgonKitOptions } from "./argon-kit";

export type EnigmaOptions = {
  aes: AesKitOptions;
  argon?: ArgonKitOptions;
  oct: OctKitOptions;
};
