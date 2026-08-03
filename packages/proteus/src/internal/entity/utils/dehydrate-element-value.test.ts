import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import type { MetaEmbeddedList } from "../types/metadata.js";
import { dehydrateElementValue } from "./dehydrate-element-value.js";

const embeddedList = {
  key: "tags",
  tableName: "user_tags",
  parentFkColumn: "user_id",
  parentPkColumn: "id",
  elementType: null,
  elementFields: null,
  elementConstructor: null,
  loading: { single: "eager", multiple: "lazy" },
} as unknown as MetaEmbeddedList;

describe("dehydrateElementValue", () => {
  test("should apply transform.to before the driver coercion", () => {
    const field = makeField("label", {
      type: "string",
      transform: {
        to: (value: unknown) => `${value as string}#`,
        from: (raw: unknown) => (raw as string).slice(0, -1),
      },
    });

    expect(
      dehydrateElementValue("alpha", field, embeddedList, (v) => `<${v as string}>`),
    ).toBe("<alpha#>");
  });

  test("should coerce a value with no transform", () => {
    const field = makeField("active", { type: "boolean" });

    expect(
      dehydrateElementValue(true, field, embeddedList, (v) => (v === true ? 1 : 0)),
    ).toBe(1);
  });

  test("should pass the value through when no coercion is given", () => {
    const field = makeField("recordedAt", { type: "timestamp" });
    const date = new Date("2024-03-05T10:15:30.000Z");

    expect(dehydrateElementValue(date, field, embeddedList)).toBe(date);
  });

  test("should not transform a null value", () => {
    const field = makeField("label", {
      type: "string",
      nullable: true,
      transform: {
        to: () => {
          throw new Error("transform.to must not run for null");
        },
        from: (raw: unknown) => raw,
      },
    });

    expect(dehydrateElementValue(null, field, embeddedList)).toBeNull();
  });

  // A collection row is written with positional parameters, so a binder must
  // never receive `undefined` — an absent element column is an explicit null.
  test("should normalise undefined to null", () => {
    const field = makeField("label", { type: "string", nullable: true });

    expect(dehydrateElementValue(undefined, field, embeddedList)).toBeNull();
  });
});
