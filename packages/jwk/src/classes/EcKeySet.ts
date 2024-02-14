import {
  generateKeyPair as _generateKeyPair,
  createPrivateKey,
  createPublicKey,
  randomUUID,
} from "crypto";
import { promisify } from "util";
import { JwkError } from "../errors";
import {
  EcKeySetB64,
  EcKeySetDer,
  EcKeySetJwk,
  EcKeySetPem,
  EcKeySetRaw,
  EllipticCurve,
  KeySetExportFormat,
  KeySetExportKeys,
} from "../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES: Array<EllipticCurve> = [
  "P-256",
  "P-384",
  "P-521",
  "secp256k1",
  "secp384r1",
  "secp521r1",
];

export class EcKeySet {
  private readonly _id: string;
  private readonly _curve: EllipticCurve;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer;

  public constructor(options: EcKeySetDer) {
    this._id = options.id;
    this._curve = options.curve;
    this._privateKey = options.privateKey;
    this._publicKey = options.publicKey;
  }

  // public metadata

  public get id(): string {
    return this._id;
  }

  public get curve(): EllipticCurve {
    return this._curve;
  }

  public get type(): "EC" {
    return "EC";
  }

  public get hasPrivateKey(): boolean {
    return Buffer.isBuffer(this._privateKey);
  }

  public get hasPublicKey(): boolean {
    return Buffer.isBuffer(this._publicKey);
  }

  // public export

  public export(format: "b64", keys?: KeySetExportKeys): EcKeySetB64;
  public export(format: "der", keys?: KeySetExportKeys): EcKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): EcKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): EcKeySetPem;
  public export(format: "raw", keys?: KeySetExportKeys): EcKeySetRaw;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): EcKeySetDer | EcKeySetJwk | EcKeySetPem {
    switch (format) {
      case "b64":
        return this.formatBase64Url(keys);

      case "der":
        return this.formatDer(keys);

      case "jwk":
        return this.formatJwk(keys);

      case "pem":
        return this.formatPem(keys);

      case "raw":
        return this.formatRaw(keys);

      default:
        throw new JwkError("Invalid format", { debug: { format } });
    }
  }

  // public static boolean

  public static isB64(input: any): input is EcKeySetB64 {
    return !!(
      typeof input === "object" &&
      input.type === "EC" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      ((typeof input.privateKey === "string" &&
        !input.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
        (typeof input.publicKey === "string" &&
          !input.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")))
    );
  }

  public static isDer(input: any): input is EcKeySetDer {
    return !!(
      typeof input === "object" &&
      input.type === "EC" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is EcKeySetJwk {
    return !!(
      typeof input === "object" &&
      input.kty === "EC" &&
      typeof input.kid === "string" &&
      CURVES.includes(input.crv) &&
      (typeof input.x === "string" || typeof input.y === "string" || typeof input.d === "string")
    );
  }

  public static isPem(input: any): input is EcKeySetPem {
    return !!(
      typeof input === "object" &&
      input.type === "EC" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      (input.privateKey?.startsWith?.("-----BEGIN PRIVATE KEY-----") ||
        input.publicKey?.startsWith?.("-----BEGIN PUBLIC KEY-----"))
    );
  }

  // public static returns EcKeySet from generation

  public static async generate(curve: EllipticCurve = "P-521"): Promise<EcKeySet> {
    const { privateKey, publicKey } = await generateKeyPair("ec", {
      namedCurve: curve,
      privateKeyEncoding: { format: "der", type: "pkcs8" },
      publicKeyEncoding: { format: "der", type: "spki" },
    });

    return new EcKeySet({ id: randomUUID(), curve, privateKey, publicKey, type: "EC" });
  }

  // public static returns EcKeySet from data

  public static fromB64(b64: EcKeySetB64): EcKeySet {
    if (!b64.publicKey) {
      throw new JwkError("Public key not available");
    }

    const publicKey = Buffer.from(b64.publicKey, "base64url");
    const privateKey = b64.privateKey ? Buffer.from(b64.privateKey, "base64url") : undefined;

    return new EcKeySet({ ...b64, privateKey, publicKey });
  }

  public static fromDer(der: EcKeySetDer): EcKeySet {
    if (!der.publicKey) {
      throw new JwkError("Public key not available");
    }
    return new EcKeySet(der);
  }

  public static fromJwk(jwk: EcKeySetJwk): EcKeySet {
    const options: EcKeySetDer = {
      id: jwk.kid,
      curve: jwk.crv,
      publicKey: Buffer.alloc(0),
      type: jwk.kty,
    };

    if (jwk.d && jwk.x && jwk.y) {
      const privateObject = createPrivateKey({ key: jwk, format: "jwk", type: "pkcs8" });
      const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

      if (!Buffer.isBuffer(privateKey)) {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      options.privateKey = privateKey;
    }

    if (jwk.x && jwk.y) {
      const publicObject = createPublicKey({ key: jwk, format: "jwk" });
      const publicKey = publicObject.export({ format: "der", type: "spki" });

      if (!Buffer.isBuffer(publicKey)) {
        throw new JwkError("Key export failed", { debug: { publicKey } });
      }

      options.publicKey = publicKey;
    }

    if (!options.privateKey && !options.publicKey?.length) {
      throw new JwkError("Formatting failed", { debug: { jwk, options } });
    }

    return new EcKeySet(options);
  }

  public static fromPem(pem: EcKeySetPem): EcKeySet {
    const options: EcKeySetDer = {
      id: pem.id,
      curve: pem.curve,
      publicKey: Buffer.alloc(0),
      type: pem.type,
    };

    if (pem.privateKey) {
      const privateObject = createPrivateKey({ key: pem.privateKey, format: "pem", type: "pkcs8" });
      const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

      if (!Buffer.isBuffer(privateKey)) {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      options.privateKey = privateKey;
    }

    if (pem.publicKey) {
      const publicObject = createPublicKey({ key: pem.publicKey, format: "pem" });
      const publicKey = publicObject.export({ format: "der", type: "spki" });

      if (!Buffer.isBuffer(publicKey)) {
        throw new JwkError("Key export failed", { debug: { publicKey } });
      }

      options.publicKey = publicKey;
    }

    if (!options.privateKey && !options.publicKey?.length) {
      throw new JwkError("Key conversion failed", { debug: { pem, options } });
    }

    return new EcKeySet(options);
  }

  public static fromRaw(raw: EcKeySetRaw): EcKeySet {
    const len = EcKeySet.getCurveLength(raw.curve);

    const jwk: EcKeySetJwk = {
      crv: raw.curve,
      kid: raw.id,
      kty: raw.type,
      x: raw.publicKey.subarray(-len, -len / 2).toString("base64"),
      y: raw.publicKey.subarray(-len / 2).toString("base64"),
    };

    if (raw.privateKey) {
      jwk.d = raw.privateKey.toString("base64");
    }

    return EcKeySet.fromJwk(jwk);
  }

  // private format

  private formatBase64Url(keys: KeySetExportKeys = "both"): EcKeySetB64 {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      id: this._id,
      curve: this._curve,
      privateKey:
        keys === "both" && this._privateKey ? this._privateKey.toString("base64url") : undefined,
      publicKey: this._publicKey.toString("base64url"),
      type: this.type,
    };
  }

  private formatDer(keys: KeySetExportKeys = "both"): EcKeySetDer {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      id: this._id,
      curve: this._curve,
      privateKey: keys === "both" ? this._privateKey : undefined,
      publicKey: this._publicKey,
      type: this.type,
    };
  }

  private formatJwk(keys: KeySetExportKeys = "both"): EcKeySetJwk {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    const result: EcKeySetJwk = { crv: this._curve, x: "", y: "", kid: this._id, kty: this.type };

    if (keys === "both" && this._privateKey) {
      const keyObject = createPrivateKey({ key: this._privateKey, format: "der", type: "pkcs8" });
      const { crv, d, x, y, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this._curve) {
        throw new JwkError("Key export failed", { debug: { crv } });
      }
      if (!d) {
        throw new JwkError("Key export failed", { debug: { d } });
      }
      if (!x) {
        throw new JwkError("Key export failed", { debug: { x } });
      }
      if (!y) {
        throw new JwkError("Key export failed", { debug: { y } });
      }
      if (kty !== "EC") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.d = d;
      result.x = x;
      result.y = y;
    }

    if (!result.x && !result.y) {
      const keyObject = createPublicKey({ key: this._publicKey, format: "der", type: "spki" });
      const { crv, x, y, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this._curve) {
        throw new JwkError("Key export failed", { debug: { crv } });
      }
      if (!x) {
        throw new JwkError("Key export failed", { debug: { x } });
      }
      if (!y) {
        throw new JwkError("Key export failed", { debug: { y } });
      }
      if (kty !== "EC") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.x = x;
      result.y = y;
    }

    return result;
  }

  private formatPem(keys: KeySetExportKeys = "both"): EcKeySetPem {
    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    const result: EcKeySetPem = {
      id: this._id,
      curve: this._curve,
      publicKey: "",
      type: this.type,
    };

    if (keys === "both" && this._privateKey) {
      const privateObject = createPrivateKey({
        key: this._privateKey,
        format: "der",
        type: "pkcs8",
      });
      const privateKey = privateObject.export({ format: "pem", type: "pkcs8" });

      if (typeof privateKey !== "string") {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      result.privateKey = privateKey;
    }

    const publicObject = createPublicKey({ key: this._publicKey, format: "der", type: "spki" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (typeof publicKey !== "string") {
      throw new JwkError("Key export failed", { debug: { publicKey } });
    }

    result.publicKey = publicKey;

    return result;
  }

  private formatRaw(keys: KeySetExportKeys = "both"): EcKeySetRaw {
    const jwk = this.formatJwk(keys);

    const result: EcKeySetRaw = {
      id: this._id,
      curve: this._curve,
      publicKey: Buffer.alloc(0),
      type: this.type,
    };

    if (jwk.d) {
      result.privateKey = Buffer.from(jwk.d, "base64");
    }

    if (!jwk.x || !jwk.y) {
      throw new JwkError("Key export failed", { debug: { jwk } });
    }

    result.publicKey = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(jwk.x, "base64"),
      Buffer.from(jwk.y, "base64"),
    ]);

    return result;
  }

  // private static

  private static getCurveLength(curve: EllipticCurve): number {
    switch (curve) {
      case "P-256":
      case "secp256k1":
        return 64;

      case "P-384":
      case "secp384r1":
        return 96;

      case "P-521":
      case "secp521r1":
        return 132;

      default:
        throw new JwkError("Unsupported curve");
    }
  }
}
