import {
  ArgonSignatureHashLength,
  ArgonSignatureMemoryCost,
  ArgonSignatureSaltLength,
  CryptoArgonOptions,
} from "../types";
import { assertArgonSignature, createArgonSignature, verifyArgonSignature } from "../utils";

export class CryptoArgon {
  private readonly hashLength: ArgonSignatureHashLength | undefined;
  private readonly memoryCost: ArgonSignatureMemoryCost | undefined;
  private readonly parallelism: number | undefined;
  private readonly saltLength: ArgonSignatureSaltLength | undefined;
  private readonly secret: string | undefined;
  private readonly timeCost: number | undefined;

  public constructor(options: CryptoArgonOptions = {}) {
    this.hashLength = options?.hashLength;
    this.memoryCost = options?.memoryCost;
    this.parallelism = options?.parallelism;
    this.saltLength = options?.saltLength;
    this.secret = options?.secret;
    this.timeCost = options?.timeCost;
  }

  public async sign(data: string): Promise<string> {
    return await createArgonSignature({
      data,
      hashLength: this.hashLength,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      saltLength: this.saltLength,
      secret: this.secret,
      timeCost: this.timeCost,
    });
  }

  public async verify(data: string, signature: string): Promise<boolean> {
    return await verifyArgonSignature({
      data,
      secret: this.secret,
      signature,
    });
  }

  public async assert(data: string, signature: string): Promise<void> {
    return await assertArgonSignature({
      data,
      secret: this.secret,
      signature,
    });
  }
}
