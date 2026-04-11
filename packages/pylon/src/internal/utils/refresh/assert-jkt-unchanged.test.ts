import { ClientError } from "@lindorm/errors";
import { assertJktUnchanged } from "./assert-jkt-unchanged";

describe("assertJktUnchanged", () => {
  test("no-op when expected is undefined (bearer-mode)", () => {
    expect(() => assertJktUnchanged(undefined, undefined)).not.toThrow();
    expect(() => assertJktUnchanged(undefined, "any")).not.toThrow();
  });

  test("accepts matching jkt", () => {
    expect(() => assertJktUnchanged("abc", "abc")).not.toThrow();
  });

  test("throws when jkt differs", () => {
    expect(() => assertJktUnchanged("abc", "xyz")).toThrow(ClientError);
  });

  test("throws when actual is missing but expected was set", () => {
    expect(() => assertJktUnchanged("abc", undefined)).toThrow(ClientError);
  });
});
