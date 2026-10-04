import { describe, expect, test } from "vitest";
import {
  defineThrowingGetter,
  proxyWithThrowingTraps,
  revokedProxy,
  UNREADABLE_THROWS,
} from "../../__fixtures__/test-helpers.js";
import {
  isReadableError,
  readCause,
  readMessage,
  readText,
  readThrownMessage,
  readValue,
} from "./read-consumer-value.js";

describe("isReadableError", () => {
  test("should classify an error as an error and anything else as not", () => {
    expect(isReadableError(new TypeError("boom"))).toBe(true);
    expect(isReadableError({ message: "boom" })).toBe(false);
    expect(isReadableError("boom")).toBe(false);
  });

  test.each([
    { label: "a proxy whose traps throw", build: proxyWithThrowingTraps },
    { label: "a revoked proxy", build: revokedProxy },
  ])("should classify $label as not an error rather than throw", ({ build }) => {
    expect(isReadableError(build())).toBe(false);
  });
});

describe("readValue", () => {
  test("should return what the read returns", () => {
    expect(readValue(() => "ENOENT")).toBe("ENOENT");
  });

  test("should return undefined when the read throws", () => {
    const error = defineThrowingGetter(new Error("boom"), "code");

    expect(readValue(() => (error as { code?: unknown }).code)).toBeUndefined();
  });
});

describe("readText", () => {
  test("should return the string form of what the read returns", () => {
    expect(readText(() => 42)).toBe("42");
  });

  test.each([
    { label: "has no string form", read: (): unknown => Object.create(null) },
    {
      label: "throws",
      read: (): unknown => {
        throw new TypeError("read boom");
      },
    },
  ])("should return an empty string when the value read $label", ({ read }) => {
    expect(readText(read)).toBe("");
  });
});

describe("readMessage", () => {
  test("should return an error's message", () => {
    expect(readMessage(new Error("boom"))).toBe("boom");
  });

  test("should return the string form of a message that is not a string", () => {
    const error = new Error("replaced");
    (error as { message: unknown }).message = 42;

    expect(readMessage(error)).toBe("42");
  });

  test("should return an empty string for a message getter that throws", () => {
    expect(readMessage(defineThrowingGetter(new Error("hidden"), "message"))).toBe("");
  });
});

describe("readCause", () => {
  test("should return an error's cause", () => {
    const cause = new Error("root");

    expect(readCause(new Error("boom", { cause }))).toBe(cause);
  });

  test("should return undefined for a cause getter that throws", () => {
    expect(readCause(defineThrowingGetter(new Error("boom"), "cause"))).toBeUndefined();
  });
});

describe("readThrownMessage", () => {
  test("should return a thrown error's message, never its string form", () => {
    expect(readThrownMessage(new TypeError("boom"))).toBe("boom");
  });

  test("should return the string form of a thrown value that is not an error", () => {
    expect(readThrownMessage("just a string")).toBe("just a string");
  });

  test.each(UNREADABLE_THROWS)(
    "should return an empty string for $label",
    ({ build }) => {
      expect(readThrownMessage(build())).toBe("");
    },
  );
});
