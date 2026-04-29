import { promisify } from "node:util";
import {
  brotliCompress,
  brotliDecompress,
  deflate,
  gzip,
  gunzip,
  inflate,
} from "node:zlib";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { IrisCompressionAlgorithm } from "../../../types/compression.js";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

export const compress = async (
  data: Buffer,
  algorithm: IrisCompressionAlgorithm,
): Promise<Buffer> => {
  switch (algorithm) {
    case "gzip":
      return gzipAsync(data);
    case "deflate":
      return deflateAsync(data);
    case "brotli":
      return brotliCompressAsync(data);
    default:
      throw new IrisSerializationError(
        `Unsupported compression algorithm: ${String(algorithm)}`,
      );
  }
};

export const decompress = async (
  data: Buffer,
  algorithm: IrisCompressionAlgorithm,
): Promise<Buffer> => {
  switch (algorithm) {
    case "gzip":
      return gunzipAsync(data);
    case "deflate":
      return inflateAsync(data);
    case "brotli":
      return brotliDecompressAsync(data);
    default:
      throw new IrisSerializationError(
        `Unsupported decompression algorithm: ${String(algorithm)}`,
      );
  }
};
