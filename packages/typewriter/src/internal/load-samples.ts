import type { ILogger } from "@lindorm/logger";
import { existsSync, readFileSync } from "fs";
import { load } from "js-yaml";
import { extname } from "path";
import { getFiles } from "./get-files.js";

type Options = {
  input: Array<string>;
  logger: ILogger;
  samples?: Array<string>;
};

// `require` survives under vitest, which shims it, but the package is ESM-only —
// so the built bin threw `require is not defined` on every JSON sample it read.
const loadJsonSample = (file: string): string =>
  JSON.stringify(JSON.parse(readFileSync(file, "utf-8")));

const loadYamlSample = (file: string): string =>
  JSON.stringify(load(readFileSync(file, "utf-8")));

export const loadSamples = (options: Options): Array<string> => {
  const samples: Array<string> = options.samples ?? [];

  for (const input of options.input) {
    options.logger.verbose(`Loading samples from input [ ${input} ]`);

    if (!existsSync(input)) {
      throw new Error(`${input} does not exist`);
    }

    const files = getFiles(input);

    for (const file of files) {
      options.logger.verbose(`Loading sample from file [ ${file} ]`);

      const ext = extname(file);

      if (ext === ".json") {
        samples.push(loadJsonSample(file));
        continue;
      }

      if (ext === ".yml" || ext === ".yaml") {
        samples.push(loadYamlSample(file));
        continue;
      }
    }
  }

  options.logger.verbose(`Loaded [ ${samples.length} ] samples`);

  return samples;
};
