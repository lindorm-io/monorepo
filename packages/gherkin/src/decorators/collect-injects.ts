import { isFunction, isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { getOwnMetadata } from "../internal/metadata/own-metadata.js";
import { readOwnInjects } from "../internal/metadata/stage-metadata.js";
import type { StagedInject } from "../internal/metadata/staged.js";

/**
 * `@Inject` fields across the class chain, leaf-first, deduplicated by field
 * name with the NEAREST declaration winning — the walk yields leaf-first, so
 * keeping the first occurrence is what lets a leaf redeclaring an inherited
 * field override its token. Dedup happens here, BEFORE any resolution: an
 * assign-in-order loop over the raw walk would let the base clobber the
 * override. Chain-walk, unlike steps/hooks: a base's shared wiring must fill
 * every extending class, and injection resolves per instance so nothing
 * registers twice. Pinned: collect-injects.test.ts.
 */
export const collectInjects = (
  target: Constructor,
  leafMetadata: DecoratorMetadataObject,
): Array<StagedInject> => {
  const collected = [...readOwnInjects(leafMetadata)];

  let ancestor = Object.getPrototypeOf(target);

  while (isFunction(ancestor)) {
    const metadata = getOwnMetadata(ancestor);

    if (isUndefined(metadata) === false) {
      collected.push(...readOwnInjects(metadata));
    }

    ancestor = Object.getPrototypeOf(ancestor);
  }

  const seen = new Set<string>();
  const deduped: Array<StagedInject> = [];

  for (const inject of collected) {
    if (seen.has(inject.fieldName) === false) {
      seen.add(inject.fieldName);
      deduped.push(inject);
    }
  }

  return deduped;
};
