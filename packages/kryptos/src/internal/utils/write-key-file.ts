import { resolve } from "path";
import { writeFileExclusive } from "./write-file-exclusive.js";

// Write an env string to `<dir>/<kid>.kryptos` at mode 0600, never overwriting.
// Returns the absolute path written.
export const writeKeyFile = (dir: string, kid: string, envString: string): string =>
  writeFileExclusive(resolve(dir, `${kid}.kryptos`), `${envString}\n`, 0o600);
