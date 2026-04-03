import { getBody } from "./get-body";

describe("getBody", () => {
  test("should return file", () => {
    expect(getBody({ file: { path: "value" } })).toBeUndefined();
  });

  test("should return body", () => {
    expect(getBody({ body: { key: "value" } })).toEqual({ key: "value" });
  });

  test("should return empty object", () => {
    expect(getBody({ status: 200 })).toEqual({});
  });

  test("should return undefined", () => {
    expect(getBody({ status: 204 })).toBeUndefined();
  });
});
