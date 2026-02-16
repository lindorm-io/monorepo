import { B64 } from "@lindorm/b64";
import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AES_FORMAT_VERSION } from "../../constants/private";
import { AesError } from "../../errors";
import { AesContentType, PublicEncryptionJwk } from "../../types";
import { validateAesVersion } from "./validate-version";

export type AesHeaderInput = {
  algorithm: KryptosAlgorithm;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  keyId: string;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionTag?: Buffer;
};

export type AesHeader = {
  alg: KryptosAlgorithm;
  cty: AesContentType;
  enc: KryptosEncryption;
  epk?: PublicEncryptionJwk;
  iv?: string;
  kid: string;
  p2c?: number;
  p2s?: string;
  tag?: string;
  v: string;
};

const sortKeys = <T extends Record<string, unknown>>(obj: T): T => {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) {
      sorted[key] = obj[key];
    }
  }
  return sorted as T;
};

export const buildAesHeader = (options: AesHeaderInput): AesHeader =>
  sortKeys({
    alg: options.algorithm,
    cty: options.contentType,
    enc: options.encryption,
    epk: options.publicEncryptionJwk,
    iv: options.publicEncryptionIv
      ? B64.encode(options.publicEncryptionIv, "b64u")
      : undefined,
    kid: options.keyId,
    p2c: options.pbkdfIterations,
    p2s: options.pbkdfSalt ? B64.encode(options.pbkdfSalt, "b64u") : undefined,
    tag: options.publicEncryptionTag
      ? B64.encode(options.publicEncryptionTag, "b64u")
      : undefined,
    v: AES_FORMAT_VERSION,
  });

export const encodeAesHeader = (header: AesHeader): string => {
  const json = JSON.stringify(header);
  return B64.encode(Buffer.from(json, "utf8"), "b64u");
};

export const decodeAesHeader = (headerB64: string): AesHeader => {
  try {
    const json = B64.toBuffer(headerB64, "b64u").toString("utf8");
    const parsed = JSON.parse(json);

    if (!parsed.alg || !parsed.enc || !parsed.v) {
      throw new AesError("Invalid AES header: missing required fields", {
        debug: { parsed },
      });
    }

    validateAesVersion(parsed.v);

    return parsed as AesHeader;
  } catch (error) {
    if (error instanceof AesError) throw error;
    throw new AesError("Failed to decode AES header", {
      error: error as Error,
    });
  }
};

export const computeAad = (headerB64: string): Buffer => Buffer.from(headerB64, "ascii");

export const headerToDecryptionParams = (
  header: AesHeader,
): {
  algorithm: KryptosAlgorithm;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: string;
} => ({
  algorithm: header.alg,
  contentType: header.cty,
  encryption: header.enc,
  keyId: header.kid,
  pbkdfIterations: header.p2c,
  pbkdfSalt: header.p2s ? B64.toBuffer(header.p2s, "b64u") : undefined,
  publicEncryptionIv: header.iv ? B64.toBuffer(header.iv, "b64u") : undefined,
  publicEncryptionJwk: header.epk,
  publicEncryptionTag: header.tag ? B64.toBuffer(header.tag, "b64u") : undefined,
  version: header.v,
});
