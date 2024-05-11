import { B64 } from "@lindorm/b64";
import { randomSecret } from "@lindorm/random";
import { KryptosError } from "../../errors";
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

const SIZES = [16, 24, 32] as const;

export const _generateOctKey = async (options: GenerateOctOptions): Promise<GenerateOctResult> => {
  const size = options.size ?? 32;

  if (![16, 24, 32].includes(size)) {
    throw new KryptosError("Invalid size", { data: { valid: SIZES } });
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
    throw new KryptosError("Invalid type", { data: { valid: "oct" } });
  }

  const result: KryptosDer = {
    type: options.kty,
    privateKey: Buffer.from(options.k, "base64url"),
  };

  return result;
};

export const _createOctDerFromPem = (options: KryptosPem): KryptosDer => {
  if (options.type !== "oct") {
    throw new KryptosError("Invalid type", { data: { valid: "oct" } });
  }
  if (!options.privateKey) {
    throw new KryptosError("Private key required");
  }

  const result: KryptosDer = {
    type: options.type,
    privateKey: Buffer.from(options.privateKey, "utf8"),
  };

  return result;
};

export const _exportOctToJwk = (options: FormatOptions): OctKeyJwk => {
  if (options.type !== "oct") {
    throw new KryptosError("Invalid type", { data: { valid: "oct" } });
  }
  if (!options.privateKey) {
    throw new KryptosError("Private key required");
  }
  if (options.mode !== "both") {
    throw new KryptosError("Mode needs to be [ Both ] for type [ oct ]");
  }

  return { k: B64.encode(options.privateKey, "base64url"), kty: options.type };
};

export const _exportOctToPem = (options: FormatOptions): KryptosPem => {
  if (options.type !== "oct") {
    throw new KryptosError("Invalid type", { data: { valid: "oct" } });
  }
  if (!options.privateKey) {
    throw new KryptosError("Private key required");
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
