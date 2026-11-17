import { resolve } from "node:path";
import { globSync } from "tinyglobby";

export type ListFeatureFilesOptions = {
  cwd: string;
  features: Array<string>;
};

// vitest's `globProjectFiles` options less its `ignore`: a step reached only from a file this
// listing leaves out is reported. pinned: no-unreached-step.test.ts
export const listFeatureFiles = ({
  cwd,
  features,
}: ListFeatureFilesOptions): Array<string> =>
  globSync(features, {
    cwd,
    dot: true,
    expandDirectories: false,
    followSymbolicLinks: true,
  }).map((path) => resolve(cwd, path));
