import { CryptoError } from "../error";
import { CryptoArgonOptions } from "../types";
import { argon2id, hash, verify } from "argon2";

export class CryptoArgon {
  private readonly hashLength: number;
  private readonly memoryCost: number;
  private readonly parallelism: number;
  private readonly saltLength: number;
  private readonly secret: Buffer | undefined;
  private readonly timeCost: number;

  public constructor(options?: CryptoArgonOptions) {
    this.hashLength = options?.hashLength || 128;
    this.memoryCost = options?.memoryCost ? options.memoryCost * 2048 : 2048;
    this.parallelism = options?.parallelism || 2;
    this.saltLength = options?.saltLength || 128;
    this.secret = options?.secret ? Buffer.from(options.secret) : undefined;
    this.timeCost = options?.timeCost || 32;
  }

  public async encrypt(input: string): Promise<string> {
    const options: Record<string, unknown> = {
      hashLength: this.hashLength,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      saltLength: this.saltLength,
      timeCost: this.timeCost,
      type: argon2id,
      ...(this.secret ? { secret: this.secret } : {}),
    };

    return hash(input, options);
  }

  public async verify(input: string, signature: string): Promise<boolean> {
    const options: Record<string, unknown> = {
      ...(this.secret ? { secret: this.secret } : {}),
    };

    return verify(signature, input, options);
  }

  public async assert(input: string, signature: string): Promise<void> {
    if (await this.verify(input, signature)) {
      return;
    }

    throw new CryptoError("Invalid Argon input");
  }
}
