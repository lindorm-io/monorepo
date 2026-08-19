import type { SpecCitation } from "../internal/registry/spec-citation.js";

/**
 * The `spec` cell for a synthetic registry entry built inside a test.
 *
 * ⚠ It is `policy` and not a real citation ON PURPOSE: `spec-citations.test.ts`
 * verifies every `rfc`/`oidc` cell against the committed corpus, so a fixture
 * claiming a section would either need a corpus entry nothing ships or would
 * fail that check. A fixture governed by nothing says so.
 */
export const SYNTHETIC_SPEC: SpecCitation = {
  kind: "policy",
  why: "A synthetic entry built by a test; no specification governs it.",
};
