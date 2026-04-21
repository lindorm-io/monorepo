import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/Entity.js";
import type {
  DiscriminatorValue,
  MetaInheritance,
  InheritanceStrategy,
} from "../types/inheritance.js";
import { collectOwn } from "./collect.js";
import {
  validateDiscriminatorRequiresInheritance,
  validateDiscriminatorValueNotOnRoot,
  validateDiscriminatorValueRequiresHierarchy,
  validateInheritanceRequiresDiscriminator,
  validateJoinedDepth,
  validateSubtypeHasDiscriminatorValue,
  validateUniqueDiscriminatorValues,
} from "./validate-inheritance.js";

/**
 * Check whether `target`'s prototype chain includes `root`.
 * Does NOT match target === root (the root itself).
 */
const isSubtypeOf = (target: Function, root: Function): boolean => {
  let current = Object.getPrototypeOf(target.prototype);
  while (current && current !== Object.prototype) {
    if (current.constructor === root) return true;
    current = Object.getPrototypeOf(current);
  }
  return false;
};

/**
 * Walk the prototype chain of `subtype` to find its direct parent entity.
 * The direct parent is the first class in the chain (between `subtype` and
 * `root`) that is either the root itself or a registered subtype in the
 * hierarchy. Non-annotated intermediate classes are skipped.
 *
 * Falls back to root if no intermediate entity is found.
 */
const findDirectParent = (
  subtype: Function,
  root: Function,
  subtypes: Array<Function>,
): Constructor<IEntity> => {
  let current = Object.getPrototypeOf(subtype);
  while (current && current !== Object.prototype) {
    if (current === root) return root as Constructor<IEntity>;
    if (subtypes.includes(current)) return current as Constructor<IEntity>;
    current = Object.getPrototypeOf(current);
  }
  // Should not happen — subtype extends root by definition
  return root as Constructor<IEntity>;
};

/**
 * Discover all inheritance hierarchies among registered entities and produce
 * a `MetaInheritance` entry for every entity that participates.
 *
 * Call this BEFORE individual entity metadata is built and cached so the
 * inheritance data can be injected into `buildPrimaryMetadata`.
 *
 * @param entities - All registered entity constructors (concrete and abstract).
 * @returns A Map from constructor to MetaInheritance for every entity in every hierarchy.
 */
export const resolveInheritanceHierarchies = (
  entities: Array<Constructor<IEntity>>,
): Map<Function, MetaInheritance> => {
  const result = new Map<Function, MetaInheritance>();

  // --- Phase 1: Run standalone validations on every entity ---
  for (const entity of entities) {
    validateDiscriminatorRequiresInheritance(entity);
    validateDiscriminatorValueRequiresHierarchy(entity);
    validateDiscriminatorValueNotOnRoot(entity);
  }

  // --- Phase 2: Find roots ---
  const roots: Array<{
    target: Constructor<IEntity>;
    strategy: InheritanceStrategy;
    discriminatorField: string;
  }> = [];

  for (const entity of entities) {
    const strategy = collectOwn(entity, "__inheritance") as
      | InheritanceStrategy
      | undefined;
    if (!strategy) continue;

    // @Inheritance present on this class — it is a root
    validateInheritanceRequiresDiscriminator(entity);

    const discriminator = collectOwn(entity, "__discriminator") as { fieldName: string };
    roots.push({
      target: entity,
      strategy,
      discriminatorField: discriminator.fieldName,
    });
  }

  // --- Phase 3: For each root, discover subtypes and build MetaInheritance entries ---
  for (const root of roots) {
    const children = new Map<DiscriminatorValue, Constructor<IEntity>>();

    // Find all entities that extend this root
    const subtypes: Array<Constructor<IEntity>> = [];
    for (const entity of entities) {
      if (entity === root.target) continue;
      if (isSubtypeOf(entity, root.target)) {
        subtypes.push(entity);
      }
    }

    // Validate and collect each subtype
    for (const subtype of subtypes) {
      validateSubtypeHasDiscriminatorValue(root.target.name, subtype);

      if (root.strategy === "joined") {
        validateJoinedDepth(root.target.name, root.target, subtype);
      }

      const discriminatorValue = collectOwn(subtype, "__discriminatorValue");
      if (discriminatorValue !== undefined) {
        validateUniqueDiscriminatorValues(
          root.target.name,
          children,
          discriminatorValue,
          subtype,
        );
        children.set(discriminatorValue, subtype);
      }
      // Abstract subtypes may not have a discriminator value — they are intermediate
    }

    // Build the shared children map (same reference for root and all children)
    const sharedChildren = new Map(children);

    // Root entry
    result.set(root.target, {
      strategy: root.strategy,
      discriminatorField: root.discriminatorField,
      discriminatorValue: null,
      root: root.target,
      parent: null,
      children: sharedChildren,
    });

    // Child entries
    for (const subtype of subtypes) {
      const discriminatorValue = collectOwn(subtype, "__discriminatorValue") ?? null;

      result.set(subtype, {
        strategy: root.strategy,
        discriminatorField: root.discriminatorField,
        discriminatorValue,
        root: root.target,
        parent: findDirectParent(subtype, root.target, subtypes),
        children: sharedChildren,
      });
    }
  }

  return result;
};
