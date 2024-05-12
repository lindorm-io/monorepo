import { AesKit } from "@lindorm/aes";
import { OctKit } from "@lindorm/oct";
import { EnigmaError } from "../errors";
import { EnigmaKitOptions } from "../types";
import { ArgonKit } from "./ArgonKit";

export class EnigmaKit {
  private aes: AesKit;
  private argon: ArgonKit;
  private oct: OctKit;

  public constructor(options: EnigmaKitOptions) {
    this.aes = new AesKit(options.aes);
    this.argon = new ArgonKit(options.argon);
    this.oct = new OctKit(options.oct);
  }

  public async hash(data: string): Promise<string> {
    const oct = this.oct.sign(data);
    const argon = await this.argon.hash(oct);
    return this.aes.encrypt(argon);
  }

  public async verify(data: string, hash: string): Promise<boolean> {
    const oct = this.oct.sign(data);
    const argon = this.aes.decrypt(hash);
    return this.argon.verify(oct, argon);
  }

  public async assert(data: string, hash: string): Promise<void> {
    if (await this.verify(data, hash)) return;
    throw new EnigmaError("Invalid Layered data");
  }
}
