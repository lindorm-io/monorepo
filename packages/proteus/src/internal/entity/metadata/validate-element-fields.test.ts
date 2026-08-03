import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import { validateElementFields } from "./validate-element-fields.js";

describe("validateElementFields", () => {
  test("should pass plain element fields through", () => {
    expect(() =>
      validateElementFields("Order", "lines", "OrderLine", [
        makeField("sku", { type: "string" }),
        makeField("quantity", { type: "integer" }),
      ]),
    ).not.toThrow();
  });

  test("should reject an @Encrypted element field", () => {
    expect(() =>
      validateElementFields("Order", "lines", "OrderLine", [
        makeField("sku", { type: "string" }),
        makeField("token", {
          type: "string",
          encrypted: { kryptos: null, condition: null },
        }),
      ]),
    ).toThrow(/@Encrypted cannot be used on @EmbeddedList element field "token"/);
  });

  test("should reject an @Encrypted element field that names a key", () => {
    expect(() =>
      validateElementFields("Order", "lines", "OrderLine", [
        makeField("token", {
          type: "string",
          encrypted: { kryptos: null, condition: { purpose: "test" } },
        }),
      ]),
    ).toThrow(/@Encrypted cannot be used on @EmbeddedList element field "token"/);
  });
});
