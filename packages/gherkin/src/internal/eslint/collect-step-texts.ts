import type { Stats } from "node:fs";
import { statSync } from "node:fs";
import { isUndefined } from "@lindorm/is";
import type { ListFeatureFilesOptions } from "./list-feature-files.js";
import { listFeatureFiles } from "./list-feature-files.js";
import { readStepTexts } from "./read-step-texts.js";

type CompiledFeature = {
  stamp: string;
  texts: Array<string>;
};

// Module state, keyed by absolute path: a lint run compiles each feature file once, and a
// long-lived process compiles it again once its stamp changes. pinned:
// no-unreached-step.cache.test.ts
const compiled = new Map<string, CompiledFeature>();

// A listed path can vanish or deny access before it is stat'ed; it contributes no steps.
// pinned: no-unreached-step.test.ts
const statFeatureFile = (file: string): Stats | undefined => {
  try {
    return statSync(file);
  } catch {
    return undefined;
  }
};

const readCompiled = (file: string, stamp: string): Array<string> => {
  const cached = compiled.get(file);

  if (cached?.stamp === stamp) {
    return cached.texts;
  }

  const texts = readStepTexts(file);

  // Uncached, so a file unreadable now is read again on the next lint. pinned:
  // no-unreached-step.cache.test.ts
  if (isUndefined(texts)) {
    return [];
  }

  compiled.set(file, { stamp, texts });

  return texts;
};

export const collectStepTexts = (options: ListFeatureFilesOptions): Array<string> => {
  const texts = listFeatureFiles(options).flatMap((file) => {
    const stats = statFeatureFile(file);

    return stats?.isFile() === true
      ? readCompiled(file, `${stats.mtimeMs}:${stats.size}`)
      : [];
  });

  return [...new Set(texts)];
};
