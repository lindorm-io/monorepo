import { randomSecret } from "@lindorm-io/random";
import { JwkError } from "../errors";
import {
  KeySetExportFormat,
  KeySetExportKeys,
  OctKeySetDer,
  OctKeySetJwk,
  OctKeySetPem,
  OctKeySize,
} from "../types";

export class OctKeySet {
  readonly #id: string | undefined;
  readonly #privateKey: Buffer;
  readonly #type: "oct";

  public constructor(options: OctKeySetDer) {
    this.#id = options.keyId;
    this.#privateKey = options.privateKey;
    this.#type = options.type;
  }

  // public metadata

  public get id(): string | undefined {
    return this.#id;
  }

  public get type(): "oct" {
    return this.#type;
  }

  // public export

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

  public static isDer(input: any): input is OctKeySetDer {
    return typeof input === "object" && Buffer.isBuffer(input.privateKey) && input.type === "oct";
  }

  public static isJwk(input: any): input is OctKeySetJwk {
    return typeof input === "object" && typeof input.k === "string" && input.kty === "oct";
  }

  public static isPem(input: any): input is OctKeySetPem {
    return (
      typeof input === "object" && typeof input.privateKey === "string" && input.type === "oct"
    );
  }

  // public static returns OctKeySet from generation

  public static async generate(size: OctKeySize = 32): Promise<OctKeySet> {
    return new OctKeySet({ privateKey: Buffer.from(randomSecret(size), "utf-8"), type: "oct" });
  }

  // public static returns EcKeySet from data

  public static fromDer(der: OctKeySetDer): OctKeySet {
    return new OctKeySet(der);
  }

  public static fromJwk(jwk: OctKeySetJwk): OctKeySet {
    return new OctKeySet({
      privateKey: Buffer.from(jwk.k, "base64url"),
      type: jwk.kty,
    });
  }

  public static fromPem(pem: OctKeySetPem): OctKeySet {
    return new OctKeySet({
      privateKey: Buffer.from(pem.privateKey, "utf-8"),
      type: pem.type,
    });
  }

  // private format

  private formatDer(): OctKeySetDer {
    return {
      privateKey: this.#privateKey,
      type: this.#type,
    };
  }

  private formatJwk(): OctKeySetJwk {
    return {
      k: this.#privateKey.toString("base64url"),
      kty: this.#type,
    };
  }

  private formatPem(): OctKeySetPem {
    return {
      privateKey: this.#privateKey.toString("utf-8"),
      type: this.#type,
    };
  }
}
