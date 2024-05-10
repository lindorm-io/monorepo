import { isBuffer, isString } from "@lindorm/is";
import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import {
  FormatOptions,
  GenerateOptions,
  GenerateResult,
  KryptosDer,
  KryptosPem,
  RsaKeyJwk,
} from "../../types";

const generateKeyPair = promisify(_generateKeyPair);

export const _generateRsaKey = async (options: GenerateOptions): Promise<GenerateResult> => {
  if (options.type !== "RSA") {
    throw new Error("Type needs to be [ RSA ]");
  }

  const modulus = options.modulus ?? 4;

  if (!modulus) {
    throw new Error("Modulus is required");
  }
  if (![1, 2, 3, 4].includes(modulus)) {
    throw new Error("Modulus needs to be [ 1 | 2 | 3 | 4 ]");
  }

  const { privateKey, publicKey } = await generateKeyPair("rsa", {
    modulusLength: modulus * 1024,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey };
};

export const _createRsaDerFromJwk = (options: RsaKeyJwk): KryptosDer => {
  if (options.kty !== "RSA") {
    throw new Error("Type needs to be [ RSA ]");
  }

  const result: KryptosDer = {
    type: options.kty,
  };

  if (options.d && options.dp && options.dq && options.p && options.q && options.qi) {
    const privateObject = createPrivateKey({ key: options, format: "jwk", type: "pkcs1" });
    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(privateKey)) {
      throw new Error("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.e && options.n) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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

export const _createRsaDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "RSA") {
    throw new Error("Type needs to be [ RSA ]");
  }

  const result: KryptosDer = {
    type: options.type,
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "pem",
      type: "pkcs1",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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
    const publicObject = createPublicKey({ key: options.publicKey, format: "pem", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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

export const _exportRsaToJwk = (options: FormatOptions): RsaKeyJwk => {
  if (options.type !== "RSA") {
    throw new Error("Type needs to be [ RSA ]");
  }

  const result: RsaKeyJwk = { e: "", n: "", kty: options.type };

  if (options.mode === "both" && options.privateKey) {
    const keyObject = createPrivateKey({ key: options.privateKey, format: "der", type: "pkcs1" });
    const { n, e, d, p, q, dp, dq, qi, kty } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new Error("Key export failed [ e ]");
    }
    if (!n) {
      throw new Error("Key export failed [ n ]");
    }
    if (!d) {
      throw new Error("Key export failed [ d ]");
    }
    if (!p) {
      throw new Error("Key export failed [ p ]");
    }
    if (!q) {
      throw new Error("Key export failed [ q ]");
    }
    if (!dp) {
      throw new Error("Key export failed [ dp ]");
    }
    if (!dq) {
      throw new Error("Key export failed [ dq ]");
    }
    if (!qi) {
      throw new Error("Key export failed [ qi ]");
    }
    if (kty !== options.type) {
      throw new Error("Key export failed [ kty ]");
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

  if (!result.e?.length && !result.n?.length) {
    if (!options.publicKey) {
      throw new Error("Public key not available");
    }

    const keyObject = createPublicKey({ key: options.publicKey, format: "der", type: "pkcs1" });
    const { e, n, kty } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new Error("Key export failed [ e ]");
    }
    if (!n) {
      throw new Error("Key export failed [ n ]");
    }
    if (kty !== "RSA") {
      throw new Error("Key export failed [ kty ]");
    }

    result.e = e;
    result.n = n;
  }

  if (!result.e?.length || !result.n?.length) {
    throw new Error("Key export failed");
  }

  return result;
};

export const _exportRsaToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "RSA") {
    throw new Error("Type needs to be [ RSA ]");
  }

  const result: KryptosPem = {
    type: options.type,
  };

  if (options.mode === "both" && options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs1",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "pem", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

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
    if (!options.publicKey) {
      throw new Error("Public key not available");
    }

    const publicObject = createPublicKey({ key: options.publicKey, format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

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
