import type { AstTag } from "../../model/collect-ast-tags.js";
import { formatAnchor } from "./format-anchor.js";
import { joinBlocks } from "./join-blocks.js";

/**
 * Anchored to the tag's own feature line — the tag IS the authoring error,
 * for both tag failures: a reserved tag (assert-supported-tags.ts) and a
 * name vitest will not accept (assert-tag-names.ts).
 */
export const formatTagError = (
  heading: string,
  tag: AstTag,
  uri: string,
  reason: string,
): string =>
  joinBlocks([heading, formatAnchor(tag.name, uri, tag.line, tag.column), reason]);
