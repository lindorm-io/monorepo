import vm from "node:vm";
import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isPromise } from "./is-promise.js";
import { describe, expect, test } from "vitest";

describe("isPromise", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isPromise(value)).toMatchSnapshot();
  });

  test.each([
    ["resolved", Promise.resolve(1)],
    ["pending", new Promise(() => {})],
    ["async fn result", (async () => 1)()],
  ])("should resolve a real %s promise", (_, value) => {
    expect(isPromise(value)).toBe(true);
  });

  test("should resolve a Promise from another realm", () => {
    const foreign = vm.runInContext("Promise.resolve(1)", vm.createContext({}));

    expect(foreign instanceof Promise).toBe(false);
    expect(isPromise(foreign)).toBe(true);
  });

  // `isPromise` asks whether this IS a Promise, not whether it is awaitable.
  // A thenable is awaitable and is not a Promise; an object carrying the three
  // method names is neither. Answering "can I await this" is `then`-only, and
  // belongs in its own guard the day something needs it.
  test.each([
    ["bare thenable", { then: (): void => undefined }],
    [
      "then/catch/finally impostor",
      { then: (): number => 1, catch: (): number => 1, finally: (): number => 1 },
    ],
    ["plain object", {}],
  ])("should NOT resolve %s", (_, value) => {
    expect(isPromise(value)).toBe(false);
  });
});
