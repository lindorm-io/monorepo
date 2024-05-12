import { Kryptos } from "@lindorm/kryptos";
import { ArgonKitOptions } from "../types";
import { _assertArgonHash, _createArgonHash, _verifyArgonHash } from "../utils/private/argon-hash";

export class ArgonKit {
  private readonly hashLength: number | undefined;
  private readonly memoryCost: number | undefined;
  private readonly parallelism: number | undefined;
  private readonly kryptos: Kryptos | undefined;
  private readonly timeCost: number | undefined;

  public constructor(options: ArgonKitOptions = {}) {
    this.hashLength = options?.hashLength;
    this.memoryCost = options?.memoryCost;
    this.parallelism = options?.parallelism;
    this.kryptos = options?.kryptos;
    this.timeCost = options?.timeCost;
  }

  public async hash(data: string): Promise<string> {
    return await _createArgonHash({
      data,
      hashLength: this.hashLength,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      kryptos: this.kryptos,
      timeCost: this.timeCost,
    });
  }

  public async verify(data: string, hash: string): Promise<boolean> {
    return await _verifyArgonHash({ data, hash, kryptos: this.kryptos });
  }

  public async assert(data: string, hash: string): Promise<void> {
    return await _assertArgonHash({ data, hash, kryptos: this.kryptos });
  }
}
