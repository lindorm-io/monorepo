import { CryptoAES, CryptoAESOptions } from "@lindorm-io/crypto";
import { TOTPError } from "../error";
import { authenticator } from "otplib";
import { baseHash, baseParse } from "@lindorm-io/core";
import { randomUUID } from "crypto";

interface Options {
  aes: CryptoAESOptions;
  issuer: string;
  numberOfBytes?: number;
}

interface GenerateData {
  signature: string;
  uri: string;
}

export class TOTPHandler {
  private readonly crypto: CryptoAES;
  private readonly issuer: string;
  private readonly numberOfBytes: number;

  public constructor(options: Options) {
    this.crypto = new CryptoAES(options.aes);
    this.issuer = options.issuer;
    this.numberOfBytes = options.numberOfBytes || 32;
  }

  public generate(): GenerateData {
    const id = randomUUID();
    const secret = authenticator.generateSecret(this.numberOfBytes);
    const uri = authenticator.keyuri(id, this.issuer, secret);
    const aes = this.crypto.encrypt(secret);
    const signature = baseHash(aes);

    return { signature, uri };
  }

  public verify(input: string, signature: string): boolean {
    const aes = baseParse(signature);
    const secret = this.crypto.decrypt(aes);

    return authenticator.check(input, secret);
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) {
      return;
    }

    throw new TOTPError("Invalid OTP input");
  }
}
