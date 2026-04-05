import type { EntityMetadata } from "../types/metadata";
import type { MetaInheritance } from "../types/inheritance";
import { resolveInheritanceRoot } from "./resolve-inheritance-root";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal entity constructors and metadata stubs
// ─────────────────────────────────────────────────────────────────────────────

class RIRRoot {}
class RIRChild {}
class RIRJoinedRoot {}
class RIRJoinedChild {}

const makeMinimalMetadata = (
  overrides: Partial<EntityMetadata> = {},
): EntityMetadata => ({
  target: RIRRoot as any,
  appendOnly: false,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { decorator: "Entity", comment: null, name: "RIRRoot", namespace: null },
  extras: [],
  fields: [],
  filters: [],
  generated: [],
  hooks: [],
  inheritance: null,
  indexes: [],
  primaryKeys: [],
  relationIds: [],
  relationCounts: [],
  relations: [],
  schemas: [],
  scopeKeys: [],
  uniques: [],
  versionKeys: [],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built metadata stubs
// ─────────────────────────────────────────────────────────────────────────────

const children = new Map([["child", RIRChild as any]]) as MetaInheritance["children"];

// Root entity: discriminatorValue is null → it IS the root
const rootMetadata = makeMinimalMetadata({
  target: RIRRoot as any,
  inheritance: {
    strategy: "single-table",
    discriminatorField: "type",
    discriminatorValue: null,
    root: RIRRoot as any,
    parent: null,
    children,
  } as MetaInheritance,
});

// Child entity: discriminatorValue is "child" → return root
const childMetadata = makeMinimalMetadata({
  target: RIRChild as any,
  entity: { decorator: "Entity", comment: null, name: "RIRChild", namespace: null },
  inheritance: {
    strategy: "single-table",
    discriminatorField: "type",
    discriminatorValue: "child",
    root: RIRRoot as any,
    parent: RIRRoot as any,
    children,
  } as MetaInheritance,
});

// Joined child: discriminatorValue set → return root
const joinedChildren = new Map([
  ["joined-child", RIRJoinedChild as any],
]) as MetaInheritance["children"];

const joinedRootMetadata = makeMinimalMetadata({
  target: RIRJoinedRoot as any,
  entity: { decorator: "Entity", comment: null, name: "RIRJoinedRoot", namespace: null },
  inheritance: {
    strategy: "joined",
    discriminatorField: "type",
    discriminatorValue: null,
    root: RIRJoinedRoot as any,
    parent: null,
    children: joinedChildren,
  } as MetaInheritance,
});

const joinedChildMetadata = makeMinimalMetadata({
  target: RIRJoinedChild as any,
  entity: { decorator: "Entity", comment: null, name: "RIRJoinedChild", namespace: null },
  inheritance: {
    strategy: "joined",
    discriminatorField: "type",
    discriminatorValue: "joined-child",
    root: RIRJoinedRoot as any,
    parent: RIRJoinedRoot as any,
    children: joinedChildren,
  } as MetaInheritance,
});

// No inheritance
const noInheritanceMetadata = makeMinimalMetadata({
  inheritance: null,
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveInheritanceRoot", () => {
  describe("single-table strategy", () => {
    test("should return the root constructor for a single-table child entity", () => {
      const result = resolveInheritanceRoot(RIRChild as any, childMetadata);
      expect(result).toBe(RIRRoot);
    });

    test("should return the target unchanged when entity IS the root (discriminatorValue is null)", () => {
      const result = resolveInheritanceRoot(RIRRoot as any, rootMetadata);
      expect(result).toBe(RIRRoot);
    });
  });

  describe("joined strategy", () => {
    test("should return the root constructor for a joined child entity", () => {
      const result = resolveInheritanceRoot(RIRJoinedChild as any, joinedChildMetadata);
      expect(result).toBe(RIRJoinedRoot);
    });

    test("should return the target unchanged when entity IS the joined root", () => {
      const result = resolveInheritanceRoot(RIRJoinedRoot as any, joinedRootMetadata);
      expect(result).toBe(RIRJoinedRoot);
    });
  });

  describe("no inheritance", () => {
    test("should return the target unchanged when entity has no inheritance metadata", () => {
      class PlainEntity {}
      const result = resolveInheritanceRoot(PlainEntity as any, noInheritanceMetadata);
      expect(result).toBe(PlainEntity);
    });
  });

  describe("numeric discriminator value", () => {
    test("should return root when child has numeric discriminator value", () => {
      class NumRoot {}
      class NumChild {}

      const numChildMeta = makeMinimalMetadata({
        target: NumChild as any,
        inheritance: {
          strategy: "single-table",
          discriminatorField: "kind",
          discriminatorValue: 1,
          root: NumRoot as any,
          parent: NumRoot as any,
          children: new Map([[1, NumChild as any]]) as MetaInheritance["children"],
        } as MetaInheritance,
      });

      const result = resolveInheritanceRoot(NumChild as any, numChildMeta);
      expect(result).toBe(NumRoot);
    });
  });
});
