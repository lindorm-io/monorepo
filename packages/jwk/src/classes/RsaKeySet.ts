import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import { JwkError } from "../errors";
import {
  KeySetExportFormat,
  KeySetExportKeys,
  RsaKeySetDer,
  RsaKeySetJwk,
  RsaKeySetPem,
} from "../types";

const generateKeyPair = promisify(_generateKeyPair);

export class RsaKeySet {
  readonly #id: string | undefined;
  readonly #privateKey: Buffer | undefined;
  readonly #publicKey: Buffer;
  readonly #type: "RSA";

  public constructor(options: RsaKeySetDer) {
    this.#id = options.keyId;
    this.#privateKey = options.privateKey;
    this.#publicKey = options.publicKey;
    this.#type = options.type;
  }

  // public metadata

  public get id(): string | undefined {
    return this.#id;
  }

  public get type(): "RSA" {
    return this.#type;
  }

  public get modulus(): 1024 | 2048 | 3072 | 4096 {
    if (this.#privateKey) {
      return this.#privateKey.length > 2200
        ? 4096
        : this.#privateKey.length > 1700
        ? 3072
        : this.#privateKey.length > 1000
        ? 2048
        : 1024;
    }

    if (this.#publicKey) {
      return this.#publicKey.length > 500
        ? 4096
        : this.#publicKey.length > 300
        ? 3072
        : this.#publicKey.length > 200
        ? 2048
        : 1024;
    }

    throw new JwkError("Key length not found");
  }

  // public export

  public export(format: "der", keys?: KeySetExportKeys): RsaKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): RsaKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): RsaKeySetPem;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): RsaKeySetDer | RsaKeySetJwk | RsaKeySetPem {
    switch (format) {
      case "der":
        return this.formatDer(keys);

      case "jwk":
        return this.formatJwk(keys);

      case "pem":
        return this.formatPem(keys);

      default:
        throw new JwkError("Invalid format", { debug: { format } });
    }
  }

  // public static boolean

  public static isDer(input: any): input is RsaKeySetDer {
    return (
      typeof input === "object" &&
      input.type === "RSA" &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is RsaKeySetJwk {
    return (
      typeof input === "object" &&
      input.kty === "RSA" &&
      (typeof input.e === "string" || typeof input.n === "string" || typeof input.d === "string")
    );
  }

  public static isPem(input: any): input is RsaKeySetPem {
    return (
      typeof input === "object" &&
      input.type === "RSA" &&
      (typeof input.privateKey === "string" || typeof input.publicKey === "string")
    );
  }

  // public static returns RsaKeySet from generation

  public static async generate(modulus: 1 | 2 | 3 | 4 = 2): Promise<RsaKeySet> {
    const { privateKey, publicKey } = await generateKeyPair("rsa", {
      modulusLength: modulus * 1024,
      publicKeyEncoding: { format: "der", type: "pkcs1" },
      privateKeyEncoding: { format: "der", type: "pkcs1" },
    });

    if (!Buffer.isBuffer(privateKey) || !Buffer.isBuffer(publicKey)) {
      throw new JwkError("Generation failed", { debug: { privateKey, publicKey } });
    }

    return new RsaKeySet({ privateKey, publicKey, type: "RSA" });
  }

  // public static returns EcKeySet from data

  public static fromDer(der: RsaKeySetDer): RsaKeySet {
    if (!der.publicKey) {
      throw new JwkError("Public key not available");
    }
    return new RsaKeySet(der);
  }

  public static fromJwk(jwk: RsaKeySetJwk): RsaKeySet {
    const options: RsaKeySetDer = { publicKey: Buffer.alloc(0), type: jwk.kty };

    if (jwk.d && jwk.dp && jwk.dq && jwk.p && jwk.q && jwk.qi) {
      const privateObject = createPrivateKey({ key: jwk, format: "jwk", type: "pkcs1" });
      const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

      if (!Buffer.isBuffer(privateKey)) {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      options.privateKey = privateKey;
    }

    if (jwk.e && jwk.n) {
      const publicObject = createPublicKey({ key: jwk, format: "jwk" });
      const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

      if (!Buffer.isBuffer(publicKey)) {
        throw new JwkError("Key export failed", { debug: { publicKey } });
      }

      options.publicKey = publicKey;
    }

    if (!options.privateKey && !options.publicKey?.length) {
      throw new JwkError("Formatting failed", { debug: { jwk, options } });
    }

    return new RsaKeySet(options);
  }

  public static fromPem(pem: RsaKeySetPem): RsaKeySet {
    const options: RsaKeySetDer = { publicKey: Buffer.alloc(0), type: pem.type };

    if (pem.privateKey) {
      const privateObject = createPrivateKey({ key: pem.privateKey, format: "pem", type: "pkcs1" });
      const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

      if (!Buffer.isBuffer(privateKey)) {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      options.privateKey = privateKey;
    }

    if (pem.publicKey) {
      const publicObject = createPublicKey({ key: pem.publicKey, format: "pem", type: "pkcs1" });
      const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

      if (!Buffer.isBuffer(publicKey)) {
        throw new JwkError("Key export failed", { debug: { publicKey } });
      }

      options.publicKey = publicKey;
    }

    if (!options.privateKey && !options.publicKey?.length) {
      throw new JwkError("Key conversion failed", { debug: { pem, options } });
    }

    return new RsaKeySet(options);
  }

  // private format

  private formatDer(keys: KeySetExportKeys = "both"): RsaKeySetDer {
    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      privateKey: keys === "both" ? this.#privateKey : undefined,
      publicKey: this.#publicKey,
      type: this.#type,
    };
  }

  private formatJwk(keys: KeySetExportKeys = "both"): RsaKeySetJwk {
    const result: RsaKeySetJwk = { e: "", n: "", kty: this.#type };

    if (keys === "both" && this.#privateKey) {
      const keyObject = createPrivateKey({ key: this.#privateKey, format: "der", type: "pkcs1" });
      const { n, e, d, p, q, dp, dq, qi, kty } = keyObject.export({ format: "jwk" });

      if (!e) {
        throw new JwkError("Key export failed", { debug: { e } });
      }
      if (!n) {
        throw new JwkError("Key export failed", { debug: { n } });
      }
      if (!d) {
        throw new JwkError("Key export failed", { debug: { d } });
      }
      if (!p) {
        throw new JwkError("Key export failed", { debug: { p } });
      }
      if (!q) {
        throw new JwkError("Key export failed", { debug: { q } });
      }
      if (!dp) {
        throw new JwkError("Key export failed", { debug: { dp } });
      }
      if (!dq) {
        throw new JwkError("Key export failed", { debug: { dq } });
      }
      if (!qi) {
        throw new JwkError("Key export failed", { debug: { qi } });
      }
      if (kty !== "RSA") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.e = e;
      result.n = n;
      result.d = d;
      result.p = p;
      result.q = q;
      result.dp = dp;
      result.dq = dq;
      result.qi = qi;
    }

    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    if (!result.e && !result.n) {
      const keyObject = createPublicKey({ key: this.#publicKey, format: "der", type: "pkcs1" });
      const { e, n, kty } = keyObject.export({ format: "jwk" });

      if (!e) {
        throw new JwkError("Key export failed", { debug: { e } });
      }
      if (!n) {
        throw new JwkError("Key export failed", { debug: { n } });
      }
      if (kty !== "RSA") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.e = e;
      result.n = n;
    }

    return result;
  }

  private formatPem(keys: KeySetExportKeys = "both"): RsaKeySetPem {
    const result: RsaKeySetPem = { publicKey: "", type: this.#type };

    if (keys === "both" && this.#privateKey) {
      const privateObject = createPrivateKey({
        key: this.#privateKey,
        format: "der",
        type: "pkcs1",
      });
      const privateKey = privateObject.export({ format: "pem", type: "pkcs1" });

      if (typeof privateKey !== "string") {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      result.privateKey = privateKey;
    }

    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    const publicObject = createPublicKey({ key: this.#publicKey, format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

    if (typeof publicKey !== "string") {
      throw new JwkError("Key export failed", { debug: { publicKey } });
    }

    result.publicKey = publicKey;

    return result;
  }
}
