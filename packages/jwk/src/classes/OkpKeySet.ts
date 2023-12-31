import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import { JwkError } from "../errors";
import {
  KeySetExportFormat,
  KeySetExportKeys,
  OctetCurve,
  OkpKeySetDer,
  OkpKeySetJwk,
  OkpKeySetPem,
} from "../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES: Array<OctetCurve> = ["Ed25519", "X25519"];

export class OkpKeySet {
  readonly #id: string | undefined;
  readonly #curve: OctetCurve;
  readonly #privateKey: Buffer | undefined;
  readonly #publicKey: Buffer;
  readonly #type: "OKP";

  public constructor(options: OkpKeySetDer) {
    this.#id = options.keyId;
    this.#curve = options.curve;
    this.#privateKey = options.privateKey;
    this.#publicKey = options.publicKey;
    this.#type = options.type;
  }

  // public metadata

  public get id(): string | undefined {
    return this.#id;
  }

  public get curve(): OctetCurve {
    return this.#curve;
  }

  public get type(): "OKP" {
    return this.#type;
  }

  // public export

  public export(format: "der", keys?: KeySetExportKeys): OkpKeySetDer;
  public export(format: "jwk", keys?: KeySetExportKeys): OkpKeySetJwk;
  public export(format: "pem", keys?: KeySetExportKeys): OkpKeySetPem;
  public export(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): OkpKeySetDer | OkpKeySetJwk | OkpKeySetPem {
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

  public static isDer(input: any): input is OkpKeySetDer {
    return (
      typeof input === "object" &&
      input.type === "OKP" &&
      CURVES.includes(input.curve) &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is OkpKeySetJwk {
    return (
      typeof input === "object" &&
      input.kty === "OKP" &&
      CURVES.includes(input.crv) &&
      (typeof input.x === "string" || typeof input.y === "string" || typeof input.d === "string")
    );
  }

  public static isPem(input: any): input is OkpKeySetPem {
    return (
      typeof input === "object" &&
      input.type === "OKP" &&
      CURVES.includes(input.curve) &&
      (typeof input.privateKey === "string" || typeof input.publicKey === "string")
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

    return new OkpKeySet({ curve, privateKey, publicKey, type: "OKP" });
  }

  // public static returns EcKeySet from data

  public static fromDer(der: OkpKeySetDer): OkpKeySet {
    if (!der.publicKey) {
      throw new JwkError("Public key not available");
    }
    return new OkpKeySet(der);
  }

  public static fromJwk(jwk: OkpKeySetJwk): OkpKeySet {
    const options: OkpKeySetDer = { curve: jwk.crv, publicKey: Buffer.alloc(0), type: jwk.kty };

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
    const options: OkpKeySetDer = { curve: pem.curve, publicKey: Buffer.alloc(0), type: pem.type };

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

  private formatDer(keys: KeySetExportKeys = "both"): OkpKeySetDer {
    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    return {
      curve: this.#curve,
      privateKey: keys === "both" ? this.#privateKey : undefined,
      publicKey: this.#publicKey,
      type: this.#type,
    };
  }

  private formatJwk(keys: KeySetExportKeys = "both"): OkpKeySetJwk {
    const result: OkpKeySetJwk = { crv: this.#curve, x: "", kty: this.#type };

    if (keys === "both" && this.#privateKey) {
      const keyObject = createPrivateKey({ key: this.#privateKey, format: "der", type: "pkcs8" });
      const { crv, d, x, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this.#curve) {
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

    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    if (!result.x) {
      const keyObject = createPublicKey({ key: this.#publicKey, format: "der", type: "spki" });
      const { crv, x, kty } = keyObject.export({ format: "jwk" });

      if (crv !== this.#curve) {
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
    const result: OkpKeySetPem = { curve: this.#curve, publicKey: "", type: this.#type };

    if (keys === "both" && this.#privateKey) {
      const privateObject = createPrivateKey({
        key: this.#privateKey,
        format: "der",
        type: "pkcs8",
      });
      const privateKey = privateObject.export({ format: "pem", type: "pkcs8" });

      if (typeof privateKey !== "string") {
        throw new JwkError("Key export failed", { debug: { privateKey } });
      }

      result.privateKey = privateKey;
    }

    if (!this.#publicKey) {
      throw new JwkError("Public key not available");
    }

    const publicObject = createPublicKey({ key: this.#publicKey, format: "der", type: "spki" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (typeof publicKey !== "string") {
      throw new JwkError("Key export failed", { debug: { publicKey } });
    }

    result.publicKey = publicKey;

    return result;
  }
}
