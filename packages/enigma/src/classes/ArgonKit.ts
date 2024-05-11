import { ArgonKitOptions } from "../types";
import { _assertArgonHash, _createArgonHash, _verifyArgonHash } from "../utils/private/argon-hash";

export class ArgonKit {
  private readonly hashLength: number | undefined;
  private readonly memoryCost: number | undefined;
  private readonly parallelism: number | undefined;
  private readonly secret: string | undefined;
  private readonly timeCost: number | undefined;

  public constructor(options: ArgonKitOptions = {}) {
    this.hashLength = options?.hashLength;
    this.memoryCost = options?.memoryCost;
    this.parallelism = options?.parallelism;
    this.secret = options?.secret;
    this.timeCost = options?.timeCost;
  }

  public async hash(data: string): Promise<string> {
    return await _createArgonHash({
      data,
      hashLength: this.hashLength,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      secret: this.secret,
      timeCost: this.timeCost,
    });
  }

  public async verify(data: string, hash: string): Promise<boolean> {
    return await _verifyArgonHash({ data, hash, secret: this.secret });
  }

  public async assert(data: string, hash: string): Promise<void> {
    return await _assertArgonHash({ data, hash, secret: this.secret });
  }
}
