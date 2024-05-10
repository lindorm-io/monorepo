import { isBuffer, isString } from "@lindorm/is";
import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import {
  EcKeyJwk,
  FormatOptions,
  GenerateOptions,
  GenerateResult,
  KryptosCurve,
  KryptosDer,
  KryptosPem,
  KryptosRaw,
} from "../../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES = ["P-256", "P-384", "P-521", "secp256k1", "secp384r1", "secp521r1"];

export const _generateEcKey = async (options: GenerateOptions): Promise<GenerateResult> => {
  if (options.type !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new Error("Curve needs to be [ P-256 | P-384 | P-521 ]");
  }

  const { privateKey, publicKey } = await generateKeyPair("ec", {
    namedCurve: options.curve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { privateKey, publicKey };
};

export const _createEcDerFromJwk = (options: EcKeyJwk): KryptosDer => {
  if (options.kty !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.crv) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.crv)) {
    throw new Error("Curve needs to be [ P-256 | P-384 | P-521 ]");
  }

  const result: KryptosDer = {
    curve: options.crv,
    type: options.kty,
  };

  if (options.d && options.x && options.y) {
    const privateObject = createPrivateKey({ key: options, format: "jwk", type: "pkcs8" });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new Error("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.x && options.y) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new Error("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey) {
    throw new Error("Key creation failed");
  }

  return result;
};

export const _createEcDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new Error("Curve needs to be [ P-256 | P-384 | P-521 ]");
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
      throw new Error("Key creation failed");
    }
    if (!isBuffer(publicKey)) {
      throw new Error("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "pem" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new Error("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey) {
    throw new Error("Key creation failed");
  }

  return result;
};

export const _createEcDerFromRaw = (options: KryptosRaw): KryptosDer => {
  if (options.type !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!options.publicKey) {
    throw new Error("Public key is required");
  }

  const len = _getCurveLength(options.curve);

  const jwk: EcKeyJwk = {
    crv: options.curve,
    kty: options.type,
    x: options.publicKey.subarray(-len, -len / 2).toString("base64"),
    y: options.publicKey.subarray(-len / 2).toString("base64"),
  };

  if (options.privateKey) {
    jwk.d = options.privateKey.toString("base64");
  }

  return _createEcDerFromJwk(jwk);
};

export const _exportEcToJwk = (options: FormatOptions): EcKeyJwk => {
  if (options.type !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new Error("Curve needs to be [ P-256 | P-384 | P-521 ]");
  }

  const result: EcKeyJwk = { x: "", y: "", crv: options.curve, kty: options.type };

  if (options.mode === "both" && options.privateKey) {
    const keyObject = createPrivateKey({ key: options.privateKey, format: "der", type: "pkcs8" });
    const { crv, d, x, y, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new Error("Key export failed [ crv ]");
    }
    if (!d) {
      throw new Error("Key export failed [ d ]");
    }
    if (!x) {
      throw new Error("Key export failed [ x ]");
    }
    if (!y) {
      throw new Error("Key export failed [ y ]");
    }
    if (kty !== options.type) {
      throw new Error("Key export failed [ kty ]");
    }

    result.d = d;
    result.x = x;
    result.y = y;
  }

  if (!result.x?.length && !result.y?.length) {
    if (!options.publicKey) {
      throw new Error("Public key not available");
    }

    const keyObject = createPublicKey({ key: options.publicKey, format: "der", type: "spki" });
    const { crv, x, y, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new Error("Key export failed [ crv ]");
    }
    if (!x) {
      throw new Error("Key export failed [ x ]");
    }
    if (!y) {
      throw new Error("Key export failed [ y ]");
    }
    if (kty !== options.type) {
      throw new Error("Key export failed [ kty ]");
    }

    result.x = x;
    result.y = y;
  }

  if (!result.x?.length || !result.y?.length) {
    throw new Error("Key export failed");
  }

  return result;
};

export const _exportEcToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "EC") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new Error("Curve needs to be [ P-256 | P-384 | P-521 ]");
  }

  const result: KryptosPem = {
    curve: options.curve,
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
      throw new Error("Key export failed [ private ]");
    }
    if (!isString(publicKey)) {
      throw new Error("Key export failed [ public ]");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "der", type: "spki" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (!isString(publicKey)) {
      throw new Error("Key export failed [ public ]");
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey) {
    throw new Error("Key export failed ");
  }

  return result;
};

export const _exportEcToRaw = (options: FormatOptions): KryptosRaw => {
  const jwk = _exportEcToJwk(options);

  if (!jwk.x || !jwk.y) {
    throw new Error("Key export failed");
  }

  const result: KryptosRaw = {
    curve: options.curve,
    ...(jwk.d ? { privateKey: Buffer.from(jwk.d, "base64") } : {}),
    publicKey: Buffer.alloc(0),
    type: options.type,
  };

  result.publicKey = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, "base64"),
    Buffer.from(jwk.y, "base64"),
  ]);

  return result;
};

const _getCurveLength = (curve: KryptosCurve): number => {
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
      throw new Error("Unsupported curve");
  }
};
