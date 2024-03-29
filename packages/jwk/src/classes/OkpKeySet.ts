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
  OctetCurve,
  OkpKeySetB64,
  OkpKeySetDer,
  OkpKeySetJwk,
  OkpKeySetPem,
} from "../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES: Array<OctetCurve> = ["Ed25519", "X25519"];

export class OkpKeySet {
  private readonly _id: string;
  private readonly _curve: OctetCurve;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer;

  public constructor(options: OkpKeySetDer) {
    this._id = options.id;
    this._curve = options.curve;
    this._privateKey = options.privateKey;
    this._publicKey = options.publicKey;
  }

  // public metadata

  public get id(): string {
    return this._id;
  }

  public get curve(): OctetCurve {
    return this._curve;
  }

  public get type(): "OKP" {
    return "OKP";
  }

  public get hasPrivateKey(): boolean {
    return Buffer.isBuffer(this._privateKey);
  }

  public get hasPublicKey(): boolean {
    return Buffer.isBuffer(this._publicKey);
  }

  // public export

  public export(format: "b64", keys?: KeySetExportKeys): OkpKeySetB64;
  public export(format: "der", keys?: KeySetExportKeys): OkpKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): OkpKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): OkpKeySetPem;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): OkpKeySetDer | OkpKeySetJwk | OkpKeySetPem {
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

  public static isB64(input: any): input is OkpKeySetB64 {
    return !!(
      typeof input === "object" &&
      input.type === "OKP" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      ((typeof input.privateKey === "string" &&
        !input.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
        (typeof input.publicKey === "string" &&
          !input.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")))
    );
  }

  public static isDer(input: any): input is OkpKeySetDer {
    return !!(
      typeof input === "object" &&
      input.type === "OKP" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is OkpKeySetJwk {
    return !!(
      typeof input === "object" &&
      input.kty === "OKP" &&
      typeof input.kid === "string" &&
      CURVES.includes(input.crv) &&
      (typeof input.x === "string" || typeof input.y === "string" || typeof input.d === "string")
    );
  }

  public static isPem(input: any): input is OkpKeySetPem {
    return !!(
      typeof input === "object" &&
      input.type === "OKP" &&
      typeof input.id === "string" &&
      CURVES.includes(input.curve) &&
      (input.privateKey?.startsWith?.("-----BEGIN PRIVATE KEY-----") ||
        input.publicKey?.startsWith?.("-----BEGIN PUBLIC KEY-----"))
    );
  }

  // public static returns OkpKeySet from generation

  public static async generate(curve: OctetCurve = "Ed25519"): Promise<OkpKeySet> {
    let privateKey: Buffer | undefined;
    let publicKey: Buffer | undefined;

    if (curve === "Ed25519") {
      ({ privateKey, publicKey } = await generateKeyPair("ed25519", {
        privateKeyEncoding: { format: "der", type: "pkcs8" },
        publicKeyEncoding: { format: "der", type: "spki" },
      }));
    }

    if (curve === "X25519") {
      ({ privateKey, publicKey } = await generateKeyPair("x25519", {
        privateKeyEncoding: { format: "der", type: "pkcs8" },
        publicKeyEncoding: { format: "der", type: "spki" },
      }));
    }

    if (!Buffer.isBuffer(privateKey) || !Buffer.isBuffer(publicKey)) {
      throw new JwkError("Generation failed", { debug: { privateKey, publicKey } });
    }

    return new OkpKeySet({ id: randomUUID(), curve, privateKey, publicKey, type: "OKP" });
  }

  // public static returns EcKeySet from data

  public static fromB64(b64: OkpKeySetB64): OkpKeySet {
    if (!b64.publicKey) {
      throw new JwkError("Public key not available");
    }

    const privateKey = b64.privateKey ? Buffer.from(b64.privateKey, "base64url") : undefined;
    const publicKey = Buffer.from(b64.publicKey, "base64url");

    return new OkpKeySet({ ...b64, privateKey, publicKey });
  }

  public static fromDer(der: OkpKeySetDer): OkpKeySet {
    if (!der.publicKey) {
      throw new JwkError("Public key not available");
    }
    return new OkpKeySet(der);
  }

  public static fromJwk(jwk: OkpKeySetJwk): OkpKeySet {
    const options: OkpKeySetDer = {
      id: jwk.kid,
      curve: jwk.crv,
      publicKey: Buffer.alloc(0),
      type: jwk.kty,
    };

    if (jwk.d && jwk.x) {
      const privateObject = createPrivateKey({ key: jwk, format: "jwk", type: "pkcs8" });
      const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

      if (!Buffer.isBuffer(privateKey)) {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      options.privateKey = privateKey;
    }

    if (jwk.x) {
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

    return new OkpKeySet(options);
  }

  public static fromPem(pem: OkpKeySetPem): OkpKeySet {
    const options: OkpKeySetDer = {
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
      const publicObject = createPublicKey({ key: pem.publicKey, format: "pem", type: "spki" });
      const publicKey = publicObject.export({ format: "der", type: "spki" });

      if (!Buffer.isBuffer(publicKey)) {
        throw new JwkError("Key export failed", { debug: { publicKey } });
      }

      options.publicKey = publicKey;
    }

    if (!options.privateKey && !options.publicKey?.length) {
      throw new JwkError("Key conversion failed", { debug: { pem, options } });
    }

    return new OkpKeySet(options);
  }

  // private format

  private formatBase64Url(keys: KeySetExportKeys = "both"): OkpKeySetB64 {
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

  private formatDer(keys: KeySetExportKeys = "both"): OkpKeySetDer {
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

  private formatJwk(keys: KeySetExportKeys = "both"): OkpKeySetJwk {
    const result: OkpKeySetJwk = { crv: this._curve, x: "", kid: this._id, kty: this.type };

    if (keys === "both" && this._privateKey) {
      const keyObject = createPrivateKey({ key: this._privateKey, format: "der", type: "pkcs8" });
      const { crv, d, x, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this._curve) {
        throw new JwkError("Key export failed", { debug: { crv } });
      }
      if (!d) {
        throw new JwkError("Key export failed", { debug: { d } });
      }
      if (!x) {
        throw new JwkError("Key export failed", { debug: { x } });
      }
      if (kty !== "OKP") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.d = d;
      result.x = x;
    }

    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    if (!result.x) {
      const keyObject = createPublicKey({ key: this._publicKey, format: "der", type: "spki" });
      const { crv, x, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this._curve) {
        throw new JwkError("Key export failed", { debug: { crv } });
      }
      if (!x) {
        throw new JwkError("Key export failed", { debug: { x } });
      }
      if (kty !== "OKP") {
        throw new JwkError("Key export failed", { debug: { kty } });
      }

      result.x = x;
    }

    return result;
  }

  private formatPem(keys: KeySetExportKeys = "both"): OkpKeySetPem {
    const result: OkpKeySetPem = {
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

    if (!this._publicKey) {
      throw new JwkError("Public key not available");
    }

    const publicObject = createPublicKey({ key: this._publicKey, format: "der", type: "spki" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (typeof publicKey !== "string") {
      throw new JwkError("Key export failed", { debug: { publicKey } });
    }

    result.publicKey = publicKey;

    return result;
  }
}
