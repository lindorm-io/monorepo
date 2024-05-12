import { isBuffer, isString } from "@lindorm/is";
import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import { KryptosError } from "../../errors";
import {
  FormatOptions,
  GenerateOkpOptions,
  GenerateOkpResult,
  KryptosCurve,
  KryptosDer,
  KryptosPem,
  OkpCurve,
  OkpKeyJwk,
} from "../../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES: Array<KryptosCurve> = ["Ed25519", "X25519", "Ed448", "X448"] as const;

export const _generateOkpKey = async (options: GenerateOkpOptions): Promise<GenerateOkpResult> => {
  const curve = options.curve ?? "Ed25519";

  if (!CURVES.includes(curve)) {
    throw new KryptosError("Invalid curve", { data: { valid: CURVES } });
  }

  const { privateKey, publicKey } = await generateKeyPair(curve.toLowerCase() as any, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};

export const _createOkpDerFromJwk = (options: OkpKeyJwk): KryptosDer => {
  if (options.kty !== "OKP") {
    throw new KryptosError("Invalid type", { data: { valid: "OKP" } });
  }
  if (!options.crv) {
    throw new KryptosError("Curve is required");
  }

  const result: KryptosDer = {
    curve: options.crv,
    type: options.kty,
  };

  if (options.d && options.x) {
    const privateObject = createPrivateKey({ key: options, format: "jwk", type: "pkcs8" });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.x) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};

export const _createOkpDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "OKP") {
    throw new KryptosError("Invalid type", { data: { valid: "OKP" } });
  }

  const result: KryptosDer = {
    curve: options.curve,
    type: options.type,
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "pem",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "pem", type: "spki" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};

export const _exportOkpToJwk = (options: FormatOptions): OkpKeyJwk => {
  if (options.type !== "OKP") {
    throw new KryptosError("Invalid type", { data: { valid: "OKP" } });
  }
  if (!options.curve) {
    throw new KryptosError("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new KryptosError("Invalid curve", { data: { valid: CURVES } });
  }

  const result: OkpKeyJwk = { x: "", crv: options.curve as OkpCurve, kty: options.type };

  if (options.mode === "both" && options.privateKey) {
    const keyObject = createPrivateKey({ key: options.privateKey, format: "der", type: "pkcs8" });
    const { crv, d, x, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!d) {
      throw new KryptosError("Key export failed [ d ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }
    if (kty !== options.type) {
      throw new KryptosError("Key export failed [ kty ]");
    }

    result.d = d;
    result.x = x;
  }

  if (!result.x?.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key not available");
    }

    const keyObject = createPublicKey({ key: options.publicKey, format: "der", type: "spki" });
    const { crv, x, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }
    if (kty !== options.type) {
      throw new KryptosError("Key export failed [ kty ]");
    }

    result.x = x;
  }

  if (!result.x?.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};

export const _exportOkpToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "OKP") {
    throw new KryptosError("Invalid type", { data: { valid: "OKP" } });
  }
  if (!options.curve) {
    throw new KryptosError("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new KryptosError("Invalid curve", { data: { valid: CURVES } });
  }

  const result: KryptosPem = {
    curve: options.curve,
    publicKey: "",
    type: options.type,
  };

  if (options.mode === "both" && options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "pem", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (!isString(privateKey)) {
      throw new KryptosError("Key export failed [ private ]");
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "der", type: "spki" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey) {
    throw new KryptosError("Key export failed ");
  }

  return result;
};
