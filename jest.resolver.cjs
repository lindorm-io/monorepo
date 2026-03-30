const path = require("path");

const packagesDir = path.join(__dirname, "packages");

/**
 * Shared jest resolver that handles Node.js subpath imports (#internal/*)
 * correctly in a monorepo where multiple packages use the same alias.
 *
 * Without this, jest's moduleNameMapper applies the SAME #internal/* mapping
 * regardless of which package's file is importing — so when package A's tests
 * load package B (which also uses #internal/*), B's internal imports resolve
 * to A's src/internal/ directory instead of B's dist/internal/.
 *
 * This resolver checks the importer's location and resolves accordingly:
 * - Files inside the "owning" package → src/internal/ (for test/dev)
 * - Files from any other package → that package's dist/internal/
 */
module.exports = (request, options) => {
  if (request.startsWith("#internal/")) {
    const suffix = request.slice("#internal/".length);

    // Which package is importing?
    const importerRelative = path.relative(packagesDir, options.basedir);
    const importerPackage = importerRelative.split(path.sep)[0];

    // Which package owns this jest run? (rootDir = packages/<name>)
    const ownerRelative = path.relative(packagesDir, options.rootDir);
    const ownerPackage = ownerRelative.split(path.sep)[0];

    if (importerPackage !== ownerPackage) {
      // Foreign package — resolve to its compiled dist/internal/
      const resolved = path.join(packagesDir, importerPackage, "dist", "internal", suffix);
      return options.defaultResolver(resolved, options);
    }

    // Owning package — resolve to src/internal/ for test coverage
    const resolved = path.join(packagesDir, ownerPackage, "src", "internal", suffix);
    return options.defaultResolver(resolved, options);
  }

  return options.defaultResolver(request, options);
};
