import { AesKit } from "@lindorm/aes";
import { EnigmaError } from "../errors";
import { EnigmaKitOptions } from "../types";
import { ArgonKit } from "./ArgonKit";
import { HmacKit } from "./HmacKit";

export class EnigmaKit {
  private aes: AesKit;
  private argon: ArgonKit;
  private hmac: HmacKit;

  public constructor(options: EnigmaKitOptions) {
    this.aes = new AesKit(options.aes);
    this.argon = new ArgonKit(options.argon);
    this.hmac = new HmacKit(options.hmac);
  }

  public async hash(data: string): Promise<string> {
    const hmac = this.hmac.hash(data);
    const argon = await this.argon.hash(hmac);
    return this.aes.encrypt(argon);
  }

  public async verify(data: string, hash: string): Promise<boolean> {
    const hmac = this.hmac.hash(data);
    const argon = this.aes.decrypt(hash);

    return this.argon.verify(hmac, argon);
  }

  public async assert(data: string, hash: string): Promise<void> {
    if (await this.verify(data, hash)) return;
    throw new EnigmaError("Invalid Layered data");
  }
}
