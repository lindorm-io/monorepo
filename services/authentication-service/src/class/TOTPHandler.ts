import { AesCipher, AesCipherOptions } from "@lindorm-io/aes";
import { randomUUID } from "crypto";
import { authenticator } from "otplib";
import { TotpError } from "../error";

interface Options {
  aes: AesCipherOptions;
  issuer: string;
  numberOfBytes?: number;
}

interface GenerateData {
  signature: string;
  uri: string;
}

export class TotpHandler {
  private readonly aes: AesCipher;
  private readonly issuer: string;
  private readonly numberOfBytes: number;

  public constructor(options: Options) {
    this.aes = new AesCipher(options.aes);
    this.issuer = options.issuer;
    this.numberOfBytes = options.numberOfBytes || 32;
  }

  public generate(): GenerateData {
    const id = randomUUID();
    const secret = authenticator.generateSecret(this.numberOfBytes);
    const uri = authenticator.keyuri(id, this.issuer, secret);
    const signature = this.aes.encrypt(secret);

    return { signature, uri };
  }

  public verify(input: string, signature: string): boolean {
    const secret = this.aes.decrypt(signature);
    return authenticator.check(input, secret);
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) return;
    throw new TotpError("Invalid TOTP input");
  }
}
