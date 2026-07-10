import { chmodSync, writeFileSync } from "fs";
import { resolve } from "path";
import { KryptosError } from "../../errors/index.js";

// Write an env string to `<dir>/<kid>.kryptos` with mode 0600, refusing to
// overwrite an existing file (O_EXCL). Returns the absolute path written.
export const writeKeyFile = (dir: string, kid: string, envString: string): string => {
  const path = resolve(dir, `${kid}.kryptos`);

  try {
    // `wx` = create-or-fail so an existing file is never clobbered.
    writeFileSync(path, `${envString}\n`, { mode: 0o600, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new KryptosError("Refusing to overwrite existing key file", {
        code: "key_file_exists",
        title: "Key File Exists",
        details: `A file already exists at ${path}; refusing to overwrite. Remove it first, or write to another directory.`,
        data: { path },
      });
    }

    throw new KryptosError("Could not write key file", {
      code: "key_file_write_failed",
      title: "Key File Write Failed",
      details: `The key file could not be written to ${path}.`,
      data: { path },
      debug: { error },
    });
  }

  // Guarantee 0600 regardless of the process umask.
  chmodSync(path, 0o600);

  return path;
};
