import {
  generateKeyPair as _generateKeyPair,
  createPrivateKey,
  createPublicKey,
  randomUUID,
} from "crypto";
import { promisify } from "util";
import { JwkError } from "../errors";
import {
  KeySetExportFormat,
  KeySetExportKeys,
  RsaKeySetB64,
  RsaKeySetDer,
  RsaKeySetJwk,
  RsaKeySetPem,
  RsaModulusOption,
} from "../types";

const generateKeyPair = promisify(_generateKeyPair);

export class RsaKeySet {
  private readonly _id: string;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer;

  public constructor(options: RsaKeySetDer) {
    this._id = options.id;
    this._privateKey = options.privateKey;
    this._publicKey = options.publicKey;
  }

  // public metadata

  public get id(): string {
    return this._id;
  }

  public get type(): "RSA" {
    return "RSA";
  }

  public get modulus(): 1024 | 2048 | 3072 | 4096 {
    if (this._privateKey) {
      return this._privateKey.length > 2200
        ? 4096
        : this._privateKey.length > 1700
        ? 3072
        : this._privateKey.length > 1000
        ? 2048
        : 1024;
    }

    if (this._publicKey) {
      return this._publicKey.length > 500
        ? 4096
        : this._publicKey.length > 300
        ? 3072
        : this._publicKey.length > 200
        ? 2048
        : 1024;
    }

    throw new JwkError("Key length not found");
  }

  public get hasPrivateKey(): boolean {
    return Buffer.isBuffer(this._privateKey);
  }

  public get hasPublicKey(): boolean {
    return Buffer.isBuffer(this._publicKey);
  }

  // public export

  public export(format: "b64", keys?: KeySetExportKeys): RsaKeySetB64;
  public export(format: "der", keys?: KeySetExportKeys): RsaKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): RsaKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): RsaKeySetPem;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): RsaKeySetDer | RsaKeySetJwk | RsaKeySetPem {
    switch (format) {
      case "b64":
        return this.formatBase64Url(keys);

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

  public static isB64(input: any): input is RsaKeySetB64 {
    return !!(
      typeof input === "object" &&
      input.type === "RSA" &&
      typeof input.id === "string" &&
      ((typeof input.privateKey === "string" &&
        !input.privateKey.startsWith("-----BEGIN RSA PRIVATE KEY-----")) ||
        (typeof input.publicKey === "string" &&
          !input.publicKey.startsWith("-----BEGIN RSA PUBLIC KEY-----")))
    );
  }

  public static isDer(input: any): input is RsaKeySetDer {
    return !!(
      typeof input === "object" &&
      input.type === "RSA" &&
      typeof input.id === "string" &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is RsaKeySetJwk {
    return !!(
      typeof input === "object" &&
      input.kty === "RSA" &&
      typeof input.kid === "string" &&
      (typeof input.e === "string" || typeof input.n === "string" || typeof input.d === "string")
    );
  }

  public static isPem(input: any): input is RsaKeySetPem {
    return !!(
      typeof input === "object" &&
      input.type === "RSA" &&
      typeof input.id === "string" &&
      (input.privateKey?.startsWith?.("-----BEGIN RSA PRIVATE KEY-----") ||
        input.publicKey?.startsWith?.("-----BEGIN RSA PUBLIC KEY-----"))
    );
  }

  // public static returns RsaKeySet from generation

  public static async generate(modulus: RsaModulusOption = 2): Promise<RsaKeySet> {
    const { privateKey, publicKey } = await generateKeyPair("rsa", {
      modulusLength: modulus * 1024,
      publicKeyEncoding: { format: "der", type: "pkcs1" },
      privateKeyEncoding: { format: "der", type: "pkcs1" },
    });

    if (!Buffer.isBuffer(privateKey) || !Buffer.isBuffer(publicKey)) {
      throw new JwkError("Generation failed", { debug: { privateKey, publicKey } });
    }

    return new RsaKeySet({ id: randomUUID(), privateKey, publicKey, type: "RSA" });
  }

  // public static returns EcKeySet from data

  public static fromB64(b64: RsaKeySetB64): RsaKeySet {
    if (!b64.publicKey) {
      throw new JwkError("Public key not available");
    }

    const privateKey = b64.privateKey ? Buffer.from(b64.privateKey, "base64url") : undefined;
    const publicKey = Buffer.from(b64.publicKey, "base64url");

    return new RsaKeySet({ ...b64, privateKey, publicKey });
  }

  public static fromDer(der: RsaKeySetDer): RsaKeySet {
    if (!der.publicKey) {
      throw new JwkError("Public key not available");
    }
    return new RsaKeySet(der);
  }

  public static fromJwk(jwk: RsaKeySetJwk): RsaKeySet {
    const options: RsaKeySetDer = { id: jwk.kid, publicKey: Buffer.alloc(0), type: jwk.kty };

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
    const options: RsaKeySetDer = { id: pem.id, publicKey: Buffer.alloc(0), type: pem.type };

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

  private formatBase64Url(keys: KeySetExportKeys = "both"): RsaKeySetB64 {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      id: this._id,
      privateKey:
        keys === "both" && this._privateKey ? this._privateKey.toString("base64url") : undefined,
      publicKey: this._publicKey.toString("base64url"),
      type: this.type,
    };
  }

  private formatDer(keys: KeySetExportKeys = "both"): RsaKeySetDer {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      id: this._id,
      privateKey: keys === "both" ? this._privateKey : undefined,
      publicKey: this._publicKey,
      type: this.type,
    };
  }

  private formatJwk(keys: KeySetExportKeys = "both"): RsaKeySetJwk {
    const result: RsaKeySetJwk = {
      kid: this._id,
      e: "",
      n: "",
      kty: this.type,
    };

    if (keys === "both" && this._privateKey) {
      const keyObject = createPrivateKey({ key: this._privateKey, format: "der", type: "pkcs1" });
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

    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    if (!result.e && !result.n) {
      const keyObject = createPublicKey({ key: this._publicKey, format: "der", type: "pkcs1" });
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
    const result: RsaKeySetPem = {
      id: this._id,
      publicKey: "",
      type: this.type,
    };

    if (keys === "both" && this._privateKey) {
      const privateObject = createPrivateKey({
        key: this._privateKey,
        format: "der",
        type: "pkcs1",
      });
      const privateKey = privateObject.export({ format: "pem", type: "pkcs1" });

      if (typeof privateKey !== "string") {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      result.privateKey = privateKey;
    }

    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    const publicObject = createPublicKey({ key: this._publicKey, format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

    if (typeof publicKey !== "string") {
      throw new JwkError("Key export failed", { debug: { publicKey } });
    }

    result.publicKey = publicKey;

    return result;
  }
}
