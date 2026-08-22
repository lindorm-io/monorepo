import type { SpecCitation } from "../internal/registry/spec-citation.js";

/**
 * The `spec` cell for a synthetic registry entry built inside a test.
 *
 * ⚠ `policy`, not a citation: a fixture invented by a test is governed by no
 * specification, and claiming a section would put a reference in the registry
 * that points at a rule this entry does not follow.
 */
export const SYNTHETIC_SPEC: SpecCitation = {
  kind: "policy",
  why: "A synthetic entry built by a test; no specification governs it.",
};
