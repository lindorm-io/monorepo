import { AesKit } from "@lindorm/aes";
import { OctKit } from "@lindorm/oct";
import { EnigmaError } from "../errors/index.js";
import type { EnigmaOptions } from "../types/index.js";
import { ArgonKit } from "./ArgonKit.js";

export class Enigma {
  private aes: AesKit;
  private argon: ArgonKit;
  private oct: OctKit;

  constructor(options: EnigmaOptions) {
    this.aes = new AesKit(options.aes);
    this.argon = new ArgonKit(options.argon);
    this.oct = new OctKit(options.oct);
  }

  async hash(data: string): Promise<string> {
    const oct = this.oct.format(this.oct.sign(data));
    const argon = await this.argon.hash(oct);
    return this.aes.encrypt(argon);
  }

  async verify(data: string, hash: string): Promise<boolean> {
    const oct = this.oct.format(this.oct.sign(data));
    const argon = this.aes.decrypt(hash);
    return this.argon.verify(oct, argon);
  }

  async assert(data: string, hash: string): Promise<void> {
    if (await this.verify(data, hash)) return;
    throw new EnigmaError("Invalid Layered data", {
      code: "layered_data_mismatch",
      title: "Layered Data Mismatch",
      details:
        "The provided data does not match the layered Argon and AES protected hash.",
    });
  }
}
