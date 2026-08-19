/**
 * `import.meta.glob` resolves a leading-slash pattern against the Vite
 * project root; a bare relative pattern would resolve against the importer —
 * the generated feature module's own directory — making the step namespace
 * depend on where the feature file sits. Root-absolute before interpolation.
 * A leading "./" is stripped first: prefixing it verbatim would yield
 * "/./steps/…", which matches nothing.
 */
export const normalizeStepPatterns = (steps: Array<string>): Array<string> =>
  steps
    .map((pattern) => (pattern.startsWith("./") ? pattern.slice(2) : pattern))
    .map((pattern) => (pattern.startsWith("/") ? pattern : `/${pattern}`));
