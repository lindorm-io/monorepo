import type { PylonHttpContext } from "../../../types/index.js";
import { fileExists } from "../file/file-exists.js";

const BROTLI = ".br";
const GZIP = ".gz";

export type StaticEncoding = "br" | "gzip";

export type StaticVariant = {
  path: string;
  encoding: StaticEncoding | null;
};

// Precompressed sibling selection, preferring brotli over gzip (mirrors
// internal/utils/get-file.ts). Content-Type is always derived from the ORIGINAL
// extension by the caller — only Content-Encoding reflects the sibling.
export const selectStaticVariant = async (
  ctx: PylonHttpContext,
  path: string,
  precompressed: boolean,
): Promise<StaticVariant> => {
  if (precompressed) {
    if (ctx.acceptsEncodings("br") && (await fileExists(path + BROTLI))) {
      return { path: path + BROTLI, encoding: "br" };
    }
    if (ctx.acceptsEncodings("gzip") && (await fileExists(path + GZIP))) {
      return { path: path + GZIP, encoding: "gzip" };
    }
  }

  return { path, encoding: null };
};
