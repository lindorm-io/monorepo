import { chmodSync, writeFileSync } from "fs";
import { KryptosError } from "../../errors/index.js";

// Write `contents` to an absolute `path` with the given mode, refusing to
// overwrite an existing file (O_EXCL via the `wx` flag). The mode is re-applied
// with chmod so it holds regardless of the process umask. Returns `path`.
export const writeFileExclusive = (
  path: string,
  contents: string,
  mode: number,
): string => {
  try {
    writeFileSync(path, contents, { mode, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new KryptosError("Refusing to overwrite existing file", {
        code: "file_exists",
        title: "File Exists",
        details: `A file already exists at ${path}; refusing to overwrite. Remove it first, or write to another directory.`,
        data: { path },
      });
    }

    throw new KryptosError("Could not write file", {
      code: "file_write_failed",
      title: "File Write Failed",
      details: `The file could not be written to ${path}.`,
      data: { path },
      debug: { error },
    });
  }

  chmodSync(path, mode);

  return path;
};
