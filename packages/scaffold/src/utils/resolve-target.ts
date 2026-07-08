import { ScaffoldError } from "../errors/ScaffoldError.js";

type ResolveTargetOptions = {
  arg?: string;
  config?: string;
  default?: string;
};

export const resolveTarget = (options: ResolveTargetOptions): string => {
  const resolved = options.arg ?? options.config ?? options.default;

  if (resolved === undefined) {
    throw new ScaffoldError("Unable to resolve scaffold target directory", {
      code: "target_unresolved",
      title: "Target directory unresolved",
      details:
        "No target directory was resolved — provide it as an argument, in lindorm.config, or via a default.",
    });
  }

  return resolved;
};
