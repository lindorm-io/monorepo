import { isBuffer, isString } from "@lindorm/is";
import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import {
  FormatOptions,
  GenerateOptions,
  GenerateResult,
  KryptosDer,
  KryptosPem,
  OkpKeyJwk,
} from "../../types";

const generateKeyPair = promisify(_generateKeyPair);

const CURVES = ["Ed25519", "X25519"];

export const _generateOkpKey = async (options: GenerateOptions): Promise<GenerateResult> => {
  if (options.type !== "OKP") {
    throw new Error("Type needs to be [ OKP ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!CURVES.includes(options.curve)) {
    throw new Error("Curve needs to be [ Ed25519 | X25519 ]");
  }

  let privateKey: Buffer;
  let publicKey: Buffer;

  switch (options.curve) {
    case "Ed25519":
      ({ privateKey, publicKey } = await generateKeyPair("ed25519", {
        privateKeyEncoding: { format: "der", type: "pkcs8" },
        publicKeyEncoding: { format: "der", type: "spki" },
      }));
      break;

    case "X25519":
      ({ privateKey, publicKey } = await generateKeyPair("x25519", {
        privateKeyEncoding: { format: "der", type: "pkcs8" },
        publicKeyEncoding: { format: "der", type: "spki" },
      }));
      break;

    default:
      throw new Error("Curve needs to be [ Ed25519 | X25519]");
  }

  return { privateKey, publicKey };
};

export const _createOkpDerFromJwk = (options: OkpKeyJwk): KryptosDer => {
  if (options.kty !== "OKP") {
    throw new Error("Type needs to be [ OKP ]");
  }
  if (!options.crv) {
    throw new Error("Curve is required");
  }

  const result: KryptosDer = {
    curve: options.crv,
    type: options.kty,
  };

  if (options.d && options.x) {
    const privateObject = createPrivateKey({ key: options, format: "jwk", type: "pkcs8" });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new Error("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.x) {
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

export const _createOkpDerFromPem = (options: KryptosPem): KryptosDer => {
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

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "pem", type: "spki" });
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

export const _exportOkpToJwk = (options: FormatOptions): OkpKeyJwk => {
  if (options.type !== "OKP") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!["Ed25519", "X25519"].includes(options.curve)) {
    throw new Error("Curve needs to be [ Ed25519 | X25519 ]");
  }

  const result: OkpKeyJwk = { x: "", crv: options.curve, kty: options.type };

  if (options.mode === "both" && options.privateKey) {
    const keyObject = createPrivateKey({ key: options.privateKey, format: "der", type: "pkcs8" });
    const { crv, d, x, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new Error("Key export failed [ crv ]");
    }
    if (!d) {
      throw new Error("Key export failed [ d ]");
    }
    if (!x) {
      throw new Error("Key export failed [ x ]");
    }
    if (kty !== options.type) {
      throw new Error("Key export failed [ kty ]");
    }

    result.d = d;
    result.x = x;
  }

  if (!result.x?.length) {
    if (!options.publicKey) {
      throw new Error("Public key not available");
    }

    const keyObject = createPublicKey({ key: options.publicKey, format: "der", type: "spki" });
    const { crv, x, kty } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new Error("Key export failed [ crv ]");
    }
    if (!x) {
      throw new Error("Key export failed [ x ]");
    }
    if (kty !== options.type) {
      throw new Error("Key export failed [ kty ]");
    }

    result.x = x;
  }

  if (!result.x?.length) {
    throw new Error("Key creation failed");
  }

  return result;
};

export const _exportOkpToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "OKP") {
    throw new Error("Type needs to be [ EC ]");
  }
  if (!options.curve) {
    throw new Error("Curve is required");
  }
  if (!["Ed25519", "X25519"].includes(options.curve)) {
    throw new Error("Curve needs to be [ Ed25519 | X25519 ]");
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