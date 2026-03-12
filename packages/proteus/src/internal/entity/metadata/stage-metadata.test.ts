import { makeField } from "../../__fixtures__/make-field";
import type { MetaHook } from "../types/metadata";
import {
  stageDiscriminator,
  stageDiscriminatorValue,
  stageEntity,
  stageField,
  stageGenerated,
  stageHook,
  stageInheritance,
} from "./stage-metadata";

const makeHook = (decorator: MetaHook["decorator"]): MetaHook => ({
  decorator,
  callback: jest.fn(),
});

describe("stage-metadata", () => {
  describe("ensureOwnArray inheritance guard", () => {
    test("should not mutate parent metadata when staging on child", () => {
      const parentMeta: any = {};
      stageField(parentMeta, makeField("id"));

      // Simulate Symbol.metadata prototype chain (child inherits parent)
      const childMeta: any = Object.create(parentMeta);
      stageField(childMeta, makeField("name"));

      // Parent's array should only have "id"
      expect(parentMeta.fields).toHaveLength(1);
      expect(parentMeta.fields[0].key).toBe("id");

      // Child has its own array with only "name"
      expect(Object.hasOwn(childMeta, "fields")).toBe(true);
      expect(childMeta.fields).toHaveLength(1);
      expect(childMeta.fields[0].key).toBe("name");
    });

    test("should create own array on first staging call", () => {
      const meta: any = {};
      stageField(meta, makeField("id"));

      expect(Object.hasOwn(meta, "fields")).toBe(true);
      expect(meta.fields).toHaveLength(1);
    });

    test("should push to existing own array on subsequent calls", () => {
      const meta: any = {};
      stageField(meta, makeField("id"));
      stageField(meta, makeField("name"));
      stageField(meta, makeField("email"));

      expect(meta.fields).toHaveLength(3);
      expect(meta.fields.map((f: any) => f.key)).toEqual(["id", "name", "email"]);
    });

    test("should isolate different metadata keys", () => {
      const meta: any = {};
      stageField(meta, makeField("id"));
      stageHook(meta, makeHook("BeforeInsert"));
      stageGenerated(meta, {
        key: "id",
        strategy: "uuid",
        length: null,
        max: null,
        min: null,
      });

      expect(meta.fields).toHaveLength(1);
      expect(meta.hooks).toHaveLength(1);
      expect(meta.generated).toHaveLength(1);
    });

    test("should not mutate parent when three-level chain is staged", () => {
      const grandparentMeta: any = {};
      stageField(grandparentMeta, makeField("id"));

      const parentMeta: any = Object.create(grandparentMeta);
      stageField(parentMeta, makeField("name"));

      const childMeta: any = Object.create(parentMeta);
      stageField(childMeta, makeField("email"));

      expect(grandparentMeta.fields).toHaveLength(1);
      expect(grandparentMeta.fields[0].key).toBe("id");

      expect(parentMeta.fields).toHaveLength(1);
      expect(parentMeta.fields[0].key).toBe("name");

      expect(childMeta.fields).toHaveLength(1);
      expect(childMeta.fields[0].key).toBe("email");
    });
  });

  describe("stageEntity (singular, no ensureOwnArray)", () => {
    test("should set entity directly on metadata", () => {
      const meta: any = {};
      stageEntity(meta, {
        decorator: "Entity",
        comment: null,
        name: "TestEntity",
        namespace: null,
      });

      expect(meta.entity.name).toBe("TestEntity");
    });

    test("should override parent entity on child metadata", () => {
      const parentMeta: any = {};
      stageEntity(parentMeta, {
        decorator: "Entity",
        comment: null,
        name: "ParentEntity",
        namespace: null,
      });

      const childMeta: any = Object.create(parentMeta);
      stageEntity(childMeta, {
        decorator: "Entity",
        comment: null,
        name: "ChildEntity",
        namespace: null,
      });

      expect(parentMeta.entity.name).toBe("ParentEntity");
      expect(childMeta.entity.name).toBe("ChildEntity");
      expect(Object.hasOwn(childMeta, "entity")).toBe(true);
    });
  });

  describe("stageInheritance", () => {
    test("should set __inheritance to 'single-table' strategy", () => {
      const meta: any = {};
      stageInheritance(meta, "single-table");

      expect(meta.__inheritance).toMatchSnapshot();
    });

    test("should set __inheritance to 'joined' strategy", () => {
      const meta: any = {};
      stageInheritance(meta, "joined");

      expect(meta.__inheritance).toMatchSnapshot();
    });

    test("should overwrite an existing __inheritance value on the same metadata", () => {
      const meta: any = {};
      stageInheritance(meta, "single-table");
      stageInheritance(meta, "joined");

      expect(meta.__inheritance).toBe("joined");
    });

    test("should set __inheritance only on own metadata, not parent", () => {
      const parentMeta: any = {};
      stageInheritance(parentMeta, "single-table");

      const childMeta: any = Object.create(parentMeta);
      stageInheritance(childMeta, "joined");

      expect(parentMeta.__inheritance).toBe("single-table");
      expect(Object.hasOwn(childMeta, "__inheritance")).toBe(true);
      expect(childMeta.__inheritance).toBe("joined");
    });
  });

  describe("stageDiscriminator", () => {
    test("should set __discriminator with fieldName 'type'", () => {
      const meta: any = {};
      stageDiscriminator(meta, "type");

      expect(meta.__discriminator).toMatchSnapshot();
    });

    test("should set __discriminator with fieldName 'kind'", () => {
      const meta: any = {};
      stageDiscriminator(meta, "kind");

      expect(meta.__discriminator).toMatchSnapshot();
    });

    test("should store fieldName on the __discriminator object", () => {
      const meta: any = {};
      stageDiscriminator(meta, "vehicleType");

      expect(meta.__discriminator).toEqual({ fieldName: "vehicleType" });
    });

    test("should overwrite existing __discriminator value", () => {
      const meta: any = {};
      stageDiscriminator(meta, "type");
      stageDiscriminator(meta, "kind");

      expect(meta.__discriminator).toEqual({ fieldName: "kind" });
    });
  });

  describe("stageDiscriminatorValue", () => {
    test("should set __discriminatorValue with string value", () => {
      const meta: any = {};
      stageDiscriminatorValue(meta, "car");

      expect(meta.__discriminatorValue).toMatchSnapshot();
    });

    test("should set __discriminatorValue with numeric value", () => {
      const meta: any = {};
      stageDiscriminatorValue(meta, 1);

      expect(meta.__discriminatorValue).toMatchSnapshot();
    });

    test("should store the exact string value", () => {
      const meta: any = {};
      stageDiscriminatorValue(meta, "truck");

      expect(meta.__discriminatorValue).toBe("truck");
    });

    test("should store the exact numeric value", () => {
      const meta: any = {};
      stageDiscriminatorValue(meta, 99);

      expect(meta.__discriminatorValue).toBe(99);
    });

    test("should overwrite existing __discriminatorValue", () => {
      const meta: any = {};
      stageDiscriminatorValue(meta, "car");
      stageDiscriminatorValue(meta, "truck");

      expect(meta.__discriminatorValue).toBe("truck");
    });
  });
});
