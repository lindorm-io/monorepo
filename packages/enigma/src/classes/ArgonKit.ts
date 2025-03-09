import { IKryptosOct, KryptosKit } from "@lindorm/kryptos";
import { OctError } from "@lindorm/oct";
import { ArgonKitOptions } from "../types";
import { assertArgonHash, createArgonHash, verifyArgonHash } from "../utils/private";

export class ArgonKit {
  private readonly hashLength: number | undefined;
  private readonly memoryCost: number | undefined;
  private readonly parallelism: number | undefined;
  private readonly kryptos: IKryptosOct | undefined;
  private readonly timeCost: number | undefined;

  public constructor(options: ArgonKitOptions = {}) {
    this.hashLength = options?.hashLength;
    this.memoryCost = options?.memoryCost;
    this.parallelism = options?.parallelism;
    this.timeCost = options?.timeCost;

    if (options.kryptos && !KryptosKit.isOct(options.kryptos)) {
      throw new OctError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public async hash(data: string): Promise<string> {
    return await createArgonHash({
      data,
      hashLength: this.hashLength,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      kryptos: this.kryptos,
      timeCost: this.timeCost,
    });
  }

  public async verify(data: string, hash: string): Promise<boolean> {
    return await verifyArgonHash({ data, hash, kryptos: this.kryptos });
  }

  public async assert(data: string, hash: string): Promise<void> {
    return await assertArgonHash({ data, hash, kryptos: this.kryptos });
  }
}
