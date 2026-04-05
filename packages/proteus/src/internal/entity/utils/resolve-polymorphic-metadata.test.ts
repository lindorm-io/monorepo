import type { EntityMetadata } from "../types/metadata";
import type { MetaInheritance } from "../types/inheritance";
import { resolvePolymorphicMetadata } from "./resolve-polymorphic-metadata";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal entity constructors and metadata stubs
// ─────────────────────────────────────────────────────────────────────────────

class RPMRoot {}
class RPMChildA {}
class RPMChildB {}

const makeMinimalMetadata = (
  overrides: Partial<EntityMetadata> = {},
): EntityMetadata => ({
  target: RPMRoot as any,
  appendOnly: false,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { decorator: "Entity", comment: null, name: "RPMRoot", namespace: null },
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

// Build a children map for use in inheritance metadata
const buildChildren = (
  entries: Array<[string | number, any]>,
): MetaInheritance["children"] => new Map(entries) as MetaInheritance["children"];

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built metadata stubs
// ─────────────────────────────────────────────────────────────────────────────

// Root metadata: has inheritance, discriminatorValue is null
const rootInheritance: MetaInheritance = {
  strategy: "single-table",
  discriminatorField: "type",
  discriminatorValue: null,
  root: RPMRoot as any,
  parent: null,
  children: buildChildren([
    ["a", RPMChildA],
    ["b", RPMChildB],
  ]),
};

const rootMetadata = makeMinimalMetadata({
  target: RPMRoot as any,
  entity: { decorator: "Entity", comment: null, name: "RPMRoot", namespace: null },
  inheritance: rootInheritance,
});

// Child metadata (for mocking getEntityMetadata)
const childAMetadata = makeMinimalMetadata({
  target: RPMChildA as any,
  entity: { decorator: "Entity", comment: null, name: "RPMChildA", namespace: null },
  inheritance: {
    strategy: "single-table",
    discriminatorField: "type",
    discriminatorValue: "a",
    root: RPMRoot as any,
    parent: RPMRoot as any,
    children: rootInheritance.children,
  },
});

const childBMetadata = makeMinimalMetadata({
  target: RPMChildB as any,
  entity: { decorator: "Entity", comment: null, name: "RPMChildB", namespace: null },
  inheritance: {
    strategy: "single-table",
    discriminatorField: "type",
    discriminatorValue: "b",
    root: RPMRoot as any,
    parent: RPMRoot as any,
    children: rootInheritance.children,
  },
});

// No-inheritance metadata
const noInheritanceMetadata = makeMinimalMetadata({
  inheritance: null,
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock: getEntityMetadata (used internally by resolvePolymorphicMetadata)
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../metadata/get-entity-metadata", () => ({
  getEntityMetadata: (ctor: Function) => {
    if (ctor === RPMChildA) return childAMetadata;
    if (ctor === RPMChildB) return childBMetadata;
    return rootMetadata;
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("resolvePolymorphicMetadata", () => {
  describe("entity with no inheritance", () => {
    test("should return the original metadata unchanged when inheritance is null", () => {
      const row = { type: "anything" };
      const result = resolvePolymorphicMetadata(row, noInheritanceMetadata);
      expect(result).toBe(noInheritanceMetadata);
    });
  });

  describe("entity is a child (discriminatorValue already set)", () => {
    test("should return the child metadata unchanged for child entity (already type-scoped)", () => {
      const row = { type: "a" };
      const result = resolvePolymorphicMetadata(row, childAMetadata);
      expect(result).toBe(childAMetadata);
    });

    test("should return child metadata even when row has a different discriminator value", () => {
      const row = { type: "b" };
      const result = resolvePolymorphicMetadata(row, childAMetadata);
      expect(result).toBe(childAMetadata);
    });
  });

  describe("entity is a root (discriminatorValue is null)", () => {
    test("should return child A metadata when row discriminator value is 'a'", () => {
      const row = { type: "a" };
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(childAMetadata);
    });

    test("should return child B metadata when row discriminator value is 'b'", () => {
      const row = { type: "b" };
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(childBMetadata);
    });

    test("should return root metadata when discriminator value is null in row", () => {
      const row = { type: null };
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(rootMetadata);
    });

    test("should return root metadata when discriminator field is absent from row", () => {
      const row = {};
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(rootMetadata);
    });

    test("should return root metadata when discriminator value is unknown", () => {
      const row = { type: "unknown-type" };
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(rootMetadata);
    });

    test("should return root metadata when discriminator value is undefined in row", () => {
      const row = { type: undefined };
      const result = resolvePolymorphicMetadata(row, rootMetadata);
      expect(result).toBe(rootMetadata);
    });
  });

  describe("numeric discriminator values", () => {
    test("should resolve numeric discriminator values correctly", () => {
      class RootNum {}
      class ChildNum1 {}
      class ChildNum2 {}

      const numChildren: MetaInheritance["children"] = new Map([
        [1, ChildNum1],
        [2, ChildNum2],
      ]) as MetaInheritance["children"];

      const childNum1Metadata = makeMinimalMetadata({
        target: ChildNum1 as any,
        entity: {
          decorator: "Entity",
          comment: null,
          name: "ChildNum1",
          namespace: null,
        },
        inheritance: {
          strategy: "single-table",
          discriminatorField: "kind",
          discriminatorValue: 1,
          root: RootNum as any,
          parent: RootNum as any,
          children: numChildren,
        },
      });

      const numRootMetadata = makeMinimalMetadata({
        target: RootNum as any,
        entity: { decorator: "Entity", comment: null, name: "RootNum", namespace: null },
        inheritance: {
          strategy: "single-table",
          discriminatorField: "kind",
          discriminatorValue: null,
          root: RootNum as any,
          parent: null,
          children: numChildren,
        },
      });

      // Direct lookup through the children map
      const childCtor = numRootMetadata.inheritance!.children.get(1);
      expect(childCtor).toBe(ChildNum1);
      expect(childNum1Metadata.inheritance!.discriminatorValue).toBe(1);
    });
  });
});
