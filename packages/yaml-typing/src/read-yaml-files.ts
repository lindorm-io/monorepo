import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { extname, join } from "path";
import { load } from "js-yaml";

interface Options {
  root: string;
  extensions: Array<string>;
}

export const readYamlFiles = (read: string, options: Partial<Options> = {}): Array<string> => {
  const { root = __dirname, extensions = [".yml", ".yaml"] } = options;

  const readDir = join(root, read);

  if (!existsSync(readDir)) {
    mkdirSync(readDir);
  }

  const files = readdirSync(readDir);
  const samples = [];

  for (const file of files) {
    const ext = extname(file);

    if (!extensions.includes(ext)) continue;

    const doc = load(readFileSync(join(readDir, file), "utf8"));

    samples.push(JSON.stringify(doc));
  }

  return samples;
};
