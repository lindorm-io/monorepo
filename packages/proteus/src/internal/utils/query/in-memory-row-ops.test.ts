import { describe, expect, test } from "vitest";
import { typedJsonMetaDictKey } from "../../entity/utils/typed-json.js";
import { applySelect } from "./in-memory-row-ops.js";

describe("applySelect", () => {
  const metaKey = typedJsonMetaDictKey("payload");

  const row = {
    id: "abc-123",
    name: "John",
    payload: { when: "2021-06-15T10:30:00.000Z" },
    [metaKey]: '{"when":"date"}',
  };

  test("should return the row unchanged when there are no selections", () => {
    expect(applySelect(row, null)).toBe(row);
    expect(applySelect(row, [])).toBe(row);
  });

  test("should project only the selected keys", () => {
    expect(applySelect(row, ["id", "name"])).toMatchSnapshot();
  });

  test("should skip a selected key that is absent from the row", () => {
    expect(applySelect(row, ["id", "missing"])).toMatchSnapshot();
  });

  test("should carry the typedJson sidecar along with its data key", () => {
    expect(applySelect(row, ["id", "payload"])).toMatchSnapshot();
  });

  test("should not invent a sidecar for a field that has none", () => {
    expect(applySelect(row, ["name"])).toMatchSnapshot();
  });
});
