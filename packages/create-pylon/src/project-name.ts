export type ParsedProjectName = {
  /** The package.json `name` — the full (possibly scoped) name as entered. */
  packageName: string;
  /** The directory to scaffold into — the unscoped basename. */
  dirName: string;
};

const SCOPED = /^@([a-z0-9-~][a-z0-9-._~]*)\/([a-z0-9-~][a-z0-9-._~]*)$/;
const UNSCOPED = /^[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Parse a project name that may be npm-scoped (`@scope/app`). The package.json
 * `name` keeps the full scoped form, while the directory is the unscoped
 * basename — so a scoped monorepo can run `create-pylon @acme/proxy` and get a
 * `proxy/` directory named `@acme/proxy`, with no manual rename.
 */
export const parseProjectName = (raw: string): ParsedProjectName => {
  const name = raw.trim();

  const scoped = SCOPED.exec(name);
  if (scoped) {
    return { packageName: name, dirName: scoped[2] };
  }

  return { packageName: name, dirName: name };
};

/** Validate a (possibly scoped) npm-style project name. */
export const isValidProjectName = (raw: string): boolean => {
  const name = raw.trim();
  if (name.length === 0) return false;
  return SCOPED.test(name) || UNSCOPED.test(name);
};
