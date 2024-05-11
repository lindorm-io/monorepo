import { AesKitOptions } from "@lindorm/aes";
import { ArgonKitOptions } from "./argon-kit";
import { HmacKitOptions } from "./hmac-kit";

export type EnigmaKitOptions = {
  aes: AesKitOptions;
  argon?: ArgonKitOptions;
  hmac: HmacKitOptions;
};
