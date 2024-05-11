import { B64 } from "@lindorm/b64";
import { randomSecret } from "@lindorm/random";
import {
  FormatOptions,
  GenerateOctOptions,
  GenerateOctResult,
  KryptosDer,
  KryptosPem,
  OctKeyJwk,
} from "../../types";

export const HEADER_SIZE = 4 as const;
export const HEADER_SYMBOL = "@" as const;

export const _generateOctKey = async (options: GenerateOctOptions): Promise<GenerateOctResult> => {
  const size = options.size ?? 32;

  if (![16, 24, 32].includes(size)) {
    throw new Error("Size needs to be [ 16 | 24 | 32 ]");
  }

  const secret = randomSecret(size);
  const split = secret.split("");
  const indices: Array<number> = [];

  while (indices.length < HEADER_SIZE) {
    const index = Math.floor(Math.random() * size);
    if (indices.includes(index)) continue;
    indices.push(index);
  }

  for (let i = 0; i < HEADER_SIZE; i++) {
    split[indices[i]] = HEADER_SYMBOL;
  }

  return { privateKey: Buffer.from(split.join(""), "utf8") };
};

export const _createOctDerFromJwk = (options: OctKeyJwk): KryptosDer => {
  if (options.kty !== "oct") {
    throw new Error("Type needs to be [ oct ]");
  }

  const result: KryptosDer = {
    type: options.kty,
    privateKey: Buffer.from(options.k, "base64url"),
  };

  return result;
};

export const _createOctDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "oct") {
    throw new Error("Type needs to be [ oct ]");
  }
  if (!options.privateKey) {
    throw new Error("Private key not available");
  }

  const result: KryptosDer = {
    type: options.type,
    privateKey: Buffer.from(options.privateKey, "utf8"),
  };

  return result;
};

export const _exportOctToJwk = (options: FormatOptions): OctKeyJwk => {
  if (options.type !== "oct") {
    throw new Error("Type needs to be [ oct ]");
  }
  if (!options.privateKey) {
    throw new Error("Private key not available");
  }
  if (options.mode !== "both") {
    throw new Error("Mode needs to be [ Both ] for type [ oct ]");
  }

  return { k: B64.encode(options.privateKey, "base64url"), kty: options.type };
};

export const _exportOctToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "oct") {
    throw new Error("Type needs to be [ oct ]");
  }
  if (!options.privateKey) {
    throw new Error("Private key not available");
  }

  return { privateKey: options.privateKey.toString("utf8"), type: options.type };
};

export const _isOctSecret = (secret: string): boolean => {
  return (
    !!secret &&
    typeof secret === "string" &&
    secret.split("").filter((char) => char === HEADER_SYMBOL).length === 4
  );
};
