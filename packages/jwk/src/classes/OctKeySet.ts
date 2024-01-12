import { randomUUID } from "crypto";
import { JwkError } from "../errors";
import {
  KeySetExportFormat,
  KeySetExportKeys,
  OctKeySetB64,
  OctKeySetDer,
  OctKeySetJwk,
  OctKeySetPem,
  OctKeySize,
} from "../types";
import { isOctSecret } from "../utils/private";
import { generateOctSecret } from "../utils/private/generate-oct-secret";

export class OctKeySet {
  readonly #id: string;
  readonly #privateKey: Buffer;
  readonly #type: "oct";

  public constructor(options: OctKeySetDer) {
    this.#id = options.id;
    this.#privateKey = options.privateKey;
    this.#type = options.type;
  }

  // public metadata

  public get id(): string {
    return this.#id;
  }

  public get type(): "oct" {
    return this.#type;
  }

  public get hasPrivateKey(): boolean {
    return Buffer.isBuffer(this.#privateKey);
  }

  public get hasPublicKey(): boolean {
    return false;
  }

  // public export

  public export(format: "b64", keys?: KeySetExportKeys): OctKeySetB64;
  public export(format: "der", keys?: KeySetExportKeys): OctKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): OctKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): OctKeySetPem;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): OctKeySetDer | OctKeySetJwk | OctKeySetPem {
    if (keys === "public") {
      throw new JwkError("Public key not available");
    }

    switch (format) {
      case "b64":
        return this.formatBase64Url();

      case "der":
        return this.formatDer();

      case "jwk":
        return this.formatJwk();

      case "pem":
        return this.formatPem();

      default:
        throw new JwkError("Invalid format", { debug: { format } });
    }
  }

  // public static boolean

  public static isB64(input: any): input is OctKeySetB64 {
    return !!(
      typeof input === "object" &&
      input.type === "oct" &&
      typeof input.id === "string" &&
      typeof input.privateKey === "string" &&
      !isOctSecret(input.privateKey)
    );
  }

  public static isDer(input: any): input is OctKeySetDer {
    return !!(
      typeof input === "object" &&
      input.type === "oct" &&
      typeof input.id === "string" &&
      Buffer.isBuffer(input.privateKey)
    );
  }

  public static isJwk(input: any): input is OctKeySetJwk {
    return !!(
      typeof input === "object" &&
      input.kty === "oct" &&
      typeof input.kid === "string" &&
      typeof input.k === "string"
    );
  }

  public static isPem(input: any): input is OctKeySetPem {
    return !!(
      typeof input === "object" &&
      input.type === "oct" &&
      typeof input.id === "string" &&
      isOctSecret(input.privateKey)
    );
  }

  // public static returns OctKeySet from generation

  public static async generate(size: OctKeySize = 32): Promise<OctKeySet> {
    return new OctKeySet({
      id: randomUUID(),
      privateKey: Buffer.from(generateOctSecret(size), "utf-8"),
      type: "oct",
    });
  }

  // public static returns EcKeySet from data

  public static fromB64(b64: OctKeySetB64): OctKeySet {
    const privateKey = Buffer.from(b64.privateKey, "base64url");

    return new OctKeySet({ ...b64, privateKey });
  }

  public static fromDer(der: OctKeySetDer): OctKeySet {
    return new OctKeySet(der);
  }

  public static fromJwk(jwk: OctKeySetJwk): OctKeySet {
    return new OctKeySet({
      id: jwk.kid,
      privateKey: Buffer.from(jwk.k, "base64url"),
      type: jwk.kty,
    });
  }

  public static fromPem(pem: OctKeySetPem): OctKeySet {
    return new OctKeySet({
      id: pem.id,
      privateKey: Buffer.from(pem.privateKey, "utf-8"),
      type: pem.type,
    });
  }

  // private format

  private formatBase64Url(): OctKeySetB64 {
    return {
      id: this.#id,
      privateKey: this.#privateKey.toString("base64url"),
      type: this.#type,
    };
  }

  private formatDer(): OctKeySetDer {
    return {
      id: this.#id,
      privateKey: this.#privateKey,
      type: this.#type,
    };
  }

  private formatJwk(): OctKeySetJwk {
    return {
      kid: this.#id,
      k: this.#privateKey.toString("base64url"),
      kty: this.#type,
    };
  }

  private formatPem(): OctKeySetPem {
    return {
      id: this.#id,
      privateKey: this.#privateKey.toString("utf-8"),
      type: this.#type,
    };
  }
}
