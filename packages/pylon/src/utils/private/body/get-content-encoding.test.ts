import { ClientError } from "@lindorm/errors";
import { getContentEncoding } from "./get-content-encoding";

describe("getContentEncoding", () => {
  test("should return null for undefined input", () => {
    expect(getContentEncoding()).toEqual(null);
  });

  test("should return null for non-string input", () => {
    expect(getContentEncoding(123 as any)).toEqual(null);
  });

  test("should return null for empty string input", () => {
    expect(getContentEncoding("")).toEqual(null);
  });

  test("should return encoding from content-type header", () => {
    expect(getContentEncoding("application/json; charset=utf-8")).toEqual("utf-8");
  });

  test("should return encoding with different case", () => {
    expect(getContentEncoding("application/json; charset=UTF-8")).toEqual("utf-8");
  });

  test("should return encoding with spaces around equals", () => {
    expect(getContentEncoding("application/json; charset = utf-8")).toEqual("utf-8");
  });

  test("should return encoding with quotes", () => {
    expect(getContentEncoding("application/json; charset='utf-8'")).toEqual("utf-8");
  });

  test("should return encoding with double quotes", () => {
    expect(getContentEncoding('application/json; charset="utf-8"')).toEqual("utf-8");
  });

  test("should return null if charset is not present", () => {
    expect(getContentEncoding("application/json")).toEqual(null);
  });

  test("should throw for invalid charset format", () => {
    expect(() => getContentEncoding("application/json; charset=invalid-charset")).toThrow(
      ClientError,
    );
  });
});
