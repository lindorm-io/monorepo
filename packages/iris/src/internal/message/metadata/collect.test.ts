import { collectAll, collectOwn, collectSingular } from "./collect.js";
import { describe, expect, it } from "vitest";

describe("collect", () => {
  describe("collectOwn", () => {
    it("should return value for own properties", () => {
      class MyMessage {}
      const meta: any = {};
      meta.__abstract = true;
      (MyMessage as any)[Symbol.metadata] = meta;

      expect(collectOwn(MyMessage, "__abstract")).toBe(true);
    });

    it("should return undefined for inherited properties", () => {
      const parentMeta: any = {};
      parentMeta.message = { decorator: "Message", name: "Parent" };

      const childMeta: any = Object.create(parentMeta);

      class Parent {}
      (Parent as any)[Symbol.metadata] = parentMeta;

      class Child extends Parent {}
      (Child as any)[Symbol.metadata] = childMeta;

      expect(collectOwn(Child, "message")).toBeUndefined();
    });

    it("should return undefined when no metadata exists", () => {
      class NoMeta {}

      expect(collectOwn(NoMeta, "fields")).toBeUndefined();
    });
  });

  describe("collectAll", () => {
    it("should merge arrays from 3-level prototype chain", () => {
      const grandparentMeta: any = {};
      grandparentMeta.fields = [{ key: "id", decorator: "IdentifierField" }];

      const parentMeta: any = Object.create(grandparentMeta);
      parentMeta.fields = [{ key: "name", decorator: "Field" }];

      const childMeta: any = Object.create(parentMeta);
      childMeta.fields = [{ key: "email", decorator: "Field" }];

      class Grandparent {}
      (Grandparent as any)[Symbol.metadata] = grandparentMeta;

      class Parent extends Grandparent {}
      (Parent as any)[Symbol.metadata] = parentMeta;

      class Child extends Parent {}
      (Child as any)[Symbol.metadata] = childMeta;

      const result = collectAll(Child, "fields");

      expect(result).toMatchSnapshot();
    });

    it("should return empty array when no metadata exists", () => {
      class NoMeta {}

      expect(collectAll(NoMeta, "fields")).toEqual([]);
    });

    it("should return empty array when key is not present at any level", () => {
      const meta: any = {};
      class MyMessage {}
      (MyMessage as any)[Symbol.metadata] = meta;

      expect(collectAll(MyMessage, "hooks")).toEqual([]);
    });
  });

  describe("collectSingular", () => {
    it("should read through prototype chain", () => {
      const parentMeta: any = {};
      parentMeta.topic = { callback: () => "events" };

      const childMeta: any = Object.create(parentMeta);

      class Parent {}
      (Parent as any)[Symbol.metadata] = parentMeta;

      class Child extends Parent {}
      (Child as any)[Symbol.metadata] = childMeta;

      const result = collectSingular(Child, "topic");
      expect(result).toBe(parentMeta.topic);
    });

    it("should return own value over inherited", () => {
      const parentMeta: any = {};
      parentMeta.priority = 1;

      const childMeta: any = Object.create(parentMeta);
      childMeta.priority = 10;

      class Parent {}
      (Parent as any)[Symbol.metadata] = parentMeta;

      class Child extends Parent {}
      (Child as any)[Symbol.metadata] = childMeta;

      expect(collectSingular(Child, "priority")).toBe(10);
    });

    it("should return undefined when not present", () => {
      const meta: any = {};
      class MyMessage {}
      (MyMessage as any)[Symbol.metadata] = meta;

      expect(collectSingular(MyMessage, "retry")).toBeUndefined();
    });

    it("should return undefined when no metadata exists", () => {
      class NoMeta {}

      expect(collectSingular(NoMeta, "topic")).toBeUndefined();
    });
  });
});
