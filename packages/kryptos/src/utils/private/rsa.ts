import { isBuffer, isString } from "@lindorm/is";
import { generateKeyPair as _generateKeyPair, createPrivateKey, createPublicKey } from "crypto";
import { promisify } from "util";
import { KryptosError } from "../../errors";
import {
  FormatOptions,
  GenerateRsaOptions,
  GenerateRsaResult,
  KryptosDer,
  KryptosPem,
  RsaKeyJwk,
} from "../../types";

const generateKeyPair = promisify(_generateKeyPair);

const MODULUS = [1, 2, 3, 4] as const;

export const _generateRsaKey = async (options: GenerateRsaOptions): Promise<GenerateRsaResult> => {
  const modulus = options.modulus ?? 4;

  if (!MODULUS.includes(modulus)) {
    throw new KryptosError("Invalid modulus", { data: { valid: MODULUS } });
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
    throw new KryptosError("Invalid type", { data: { valid: "RSA" } });
  }

  const result: KryptosDer = {
    type: options.kty,
  };

  if (options.d && options.dp && options.dq && options.p && options.q && options.qi) {
    const privateObject = createPrivateKey({ key: options, format: "jwk", type: "pkcs1" });
    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.e && options.n) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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

export const _createRsaDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "RSA") {
    throw new KryptosError("Invalid type", { data: { valid: "RSA" } });
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
      throw new KryptosError("Key creation failed");
    }
    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "pem", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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

export const _exportRsaToJwk = (options: FormatOptions): RsaKeyJwk => {
  if (options.type !== "RSA") {
    throw new KryptosError("Invalid type", { data: { valid: "RSA" } });
  }

  const result: RsaKeyJwk = { e: "", n: "", kty: options.type };

  if (options.mode === "both" && options.privateKey) {
    const keyObject = createPrivateKey({ key: options.privateKey, format: "der", type: "pkcs1" });
    const { n, e, d, p, q, dp, dq, qi, kty } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new KryptosError("Key export failed [ e ]");
    }
    if (!n) {
      throw new KryptosError("Key export failed [ n ]");
    }
    if (!d) {
      throw new KryptosError("Key export failed [ d ]");
    }
    if (!p) {
      throw new KryptosError("Key export failed [ p ]");
    }
    if (!q) {
      throw new KryptosError("Key export failed [ q ]");
    }
    if (!dp) {
      throw new KryptosError("Key export failed [ dp ]");
    }
    if (!dq) {
      throw new KryptosError("Key export failed [ dq ]");
    }
    if (!qi) {
      throw new KryptosError("Key export failed [ qi ]");
    }
    if (kty !== options.type) {
      throw new KryptosError("Key export failed [ kty ]");
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
      throw new KryptosError("Public key is required");
    }

    const keyObject = createPublicKey({ key: options.publicKey, format: "der", type: "pkcs1" });
    const { e, n, kty } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new KryptosError("Key export failed [ e ]");
    }
    if (!n) {
      throw new KryptosError("Key export failed [ n ]");
    }
    if (kty !== "RSA") {
      throw new KryptosError("Key export failed [ kty ]");
    }

    result.e = e;
    result.n = n;
  }

  if (!result.e?.length || !result.n?.length) {
    throw new KryptosError("Key export failed");
  }

  return result;
};

export const _exportRsaToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "RSA") {
    throw new KryptosError("Invalid type", { data: { valid: "RSA" } });
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
      throw new KryptosError("Key export failed [ private ]");
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey && options.publicKey) {
    if (!options.publicKey) {
      throw new KryptosError("Public key is required");
    }

    const publicObject = createPublicKey({ key: options.publicKey, format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

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
