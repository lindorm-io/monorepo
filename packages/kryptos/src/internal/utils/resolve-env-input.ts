import { readFileSync } from "fs";
import { resolve } from "path";
import { KryptosError } from "../../errors/index.js";

// Resolve a CLI input that is EITHER an inline `kryptos:…` env string OR a path
// to a `.kryptos` file. Detection: a `kryptos:` prefix means inline; anything
// else is treated as a file path, read, trimmed, and required to hold a
// `kryptos:` env string. Shared by --ca, --seed, and `inspect`.
export const resolveEnvInput = (input: string, label: string): string => {
  const trimmed = input.trim();

  if (trimmed.startsWith("kryptos:")) {
    return trimmed;
  }

  const path = resolve(trimmed);

  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    throw new KryptosError(`Could not read ${label} file`, {
      code: "env_file_unreadable",
      title: "Env File Unreadable",
      details: `The ${label} was not an inline kryptos:… string and could not be read as a file: ${path}.`,
      data: { path },
      debug: { error },
    });
  }

  const env = contents.trim();
  if (!env.startsWith("kryptos:")) {
    throw new KryptosError(`File does not contain a ${label}`, {
      code: "invalid_env_file",
      title: "Invalid Env File",
      details: `The file ${path} does not contain a kryptos:… env string.`,
      data: { path },
    });
  }

  return env;
};
