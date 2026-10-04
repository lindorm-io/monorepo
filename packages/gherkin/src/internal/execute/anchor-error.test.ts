import { describe, expect, test } from "vitest";
import { anchorError, markReported } from "./anchor-error.js";

const format = (message: string): string => `anchored: ${message}`;

const proxyWithThrowingTraps = (): object =>
  new Proxy(
    {},
    {
      get: () => {
        throw new TypeError("trap: get");
      },
      getPrototypeOf: () => {
        throw new TypeError("trap: getPrototypeOf");
      },
    },
  );

const revokedProxy = (): object => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();

  return proxy;
};

const unclassifiable = [
  { label: "a Proxy whose traps throw", build: proxyWithThrowingTraps },
  { label: "a revoked Proxy", build: revokedProxy },
];

describe("anchorError", () => {
  test("should keep a writable instance, writing the anchor into its message", () => {
    const thrown = new Error("boom") as Error & { actual: string; expected: string };
    thrown.actual = "a";
    thrown.expected = "b";

    const reported = anchorError(thrown, format);

    expect(reported).toBe(thrown);
    expect(reported.message).toBe("anchored: boom");
    expect(reported).toHaveProperty("actual", "a");
    expect(reported).toHaveProperty("expected", "b");
  });

  test("should keep a writable instance that carries no message of its own", () => {
    const thrown = new Error();

    const reported = anchorError(thrown, format);

    expect(reported).toBe(thrown);
    expect(reported.message).toBe("anchored: ");
  });

  test("should report a frozen instance in a new error, its own message anchored, the original as cause", () => {
    const thrown = Object.freeze(new Error("frozen boom"));

    const reported = anchorError(thrown, format);

    expect(reported).not.toBe(thrown);
    expect(reported.message).toBe("anchored: frozen boom");
    expect(reported.cause).toBe(thrown);
    expect(thrown.message).toBe("frozen boom");
  });

  test("should report an instance with a read-only message in a new error, leaving the message as thrown", () => {
    const thrown = new Error("read-only boom");
    Object.defineProperty(thrown, "message", { writable: false });

    const reported = anchorError(thrown, format);

    expect(reported).not.toBe(thrown);
    expect(reported.message).toBe("anchored: read-only boom");
    expect(reported.cause).toBe(thrown);
    expect(thrown.message).toBe("read-only boom");
  });

  test("should report a non-extensible instance without a message of its own in a new error", () => {
    const thrown = Object.preventExtensions(new Error());

    const reported = anchorError(thrown, format);

    expect(reported).not.toBe(thrown);
    expect(reported.message).toBe("anchored: ");
    expect(reported.cause).toBe(thrown);
    expect(Object.hasOwn(thrown, "message")).toBe(false);
  });

  test("should anchor an instance thrown again from its unanchored message, in a new error, leaving the first anchor alone", () => {
    const thrown = new Error("shared boom");

    const first = anchorError(thrown, format);
    const second = anchorError(thrown, (message) => `again: ${message}`);
    const third = anchorError(thrown, (message) => `third: ${message}`);

    expect(first).toBe(thrown);
    expect(second).not.toBe(thrown);
    expect(second.message).toBe("again: shared boom");
    expect(second.cause).toBe(thrown);
    expect(third.message).toBe("third: shared boom");
    expect(third.cause).toBe(thrown);
    expect(thrown.message).toBe("anchored: shared boom");
  });

  test("should anchor a frozen instance thrown again from its own message, never nesting", () => {
    const thrown = Object.freeze(new Error("frozen boom"));

    const first = anchorError(thrown, format);
    const second = anchorError(thrown, (message) => `again: ${message}`);

    expect(first.message).toBe("anchored: frozen boom");
    expect(second.message).toBe("again: frozen boom");
    expect(second).not.toBe(first);
    expect(second.cause).toBe(thrown);
  });

  test.each([
    { label: "undefined", message: undefined, text: "undefined" },
    { label: "an object", message: { code: 42 }, text: "[object Object]" },
    { label: "an object with no string form", message: Object.create(null), text: "" },
  ])(
    "should anchor an instance whose message is not a string once, however often thrown ($label)",
    ({ message, text }) => {
      const thrown = new Error("replaced");
      (thrown as { message: unknown }).message = message;

      const first = anchorError(thrown, format);
      const second = anchorError(thrown, (unanchored) => `again: ${unanchored}`);

      expect(first).toBe(thrown);
      expect(thrown.message).toBe(`anchored: ${text}`);
      expect(second).not.toBe(thrown);
      expect(second.message).toBe(`again: ${text}`);
      expect(second.cause).toBe(thrown);
    },
  );

  test("should wrap a non-Error throw in a new error carrying its string form, the thrown value as cause", () => {
    const reported = anchorError("just a string", format);

    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe("anchored: just a string");
    expect(reported.cause).toBe("just a string");
  });

  test("should wrap a non-Error throw that has no string form in a new error with an empty message, the thrown value as cause", () => {
    const thrown: unknown = Object.create(null);

    const reported = anchorError(thrown, format);

    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe("anchored: ");
    expect(reported.cause).toBe(thrown);
  });

  test.each(unclassifiable)(
    "should wrap $label, which cannot be classified, in a new error with an empty message, the value as cause",
    ({ build }) => {
      const thrown = build();

      const reported = anchorError(thrown, format);

      expect(reported).toBeInstanceOf(Error);
      expect(reported.message).toBe("anchored: ");
      expect(reported.cause).toBe(thrown);
    },
  );

  test("should report an instance whose message setter swallows the write in a new error, leaving the message as thrown", () => {
    const thrown = new Error("swallowed boom");
    Object.defineProperty(thrown, "message", {
      get: () => "swallowed boom",
      set: () => {},
    });

    const reported = anchorError(thrown, format);

    expect(reported.cause).toBe(thrown);
    expect(reported.message).toBe("anchored: swallowed boom");
    expect(thrown.message).toBe("swallowed boom");
  });

  test("should report an instance whose message getter throws although its setter works in a new error", () => {
    const thrown = new Error("hidden boom");
    let written: unknown;
    Object.defineProperty(thrown, "message", {
      get: () => {
        throw new TypeError("message getter boom");
      },
      set: (value: unknown) => {
        written = value;
      },
    });

    const reported = anchorError(thrown, format);

    expect(written).toBe("anchored: ");
    expect(reported.cause).toBe(thrown);
    expect(reported.message).toBe("anchored: ");
  });
});

describe("markReported", () => {
  test("should anchor a reported instance thrown later in a new error, leaving its message as reported", () => {
    const thrown = new Error("reported boom");

    markReported(thrown);
    const reported = anchorError(thrown, format);

    expect(reported).not.toBe(thrown);
    expect(reported.message).toBe("anchored: reported boom");
    expect(reported.cause).toBe(thrown);
    expect(thrown.message).toBe("reported boom");
  });

  test("should keep an anchored instance's unanchored message when it is reported afterwards", () => {
    const thrown = new Error("shared boom");

    anchorError(thrown, format);
    markReported(thrown);
    const again = anchorError(thrown, (message) => `again: ${message}`);

    expect(again.message).toBe("again: shared boom");
    expect(thrown.message).toBe("anchored: shared boom");
  });

  test("should report every error on the cause chain", () => {
    const root = new Error("root boom");
    const middle = new Error("middle boom", { cause: root });

    markReported(new Error("top boom", { cause: middle }));
    const fromMiddle = anchorError(middle, format);
    const fromRoot = anchorError(root, format);

    expect(fromMiddle).not.toBe(middle);
    expect(fromMiddle.message).toBe("anchored: middle boom");
    expect(middle.message).toBe("middle boom");
    expect(fromRoot).not.toBe(root);
    expect(fromRoot.message).toBe("anchored: root boom");
    expect(root.message).toBe("root boom");
  });

  test("should report a cause chain that loops back on itself, and return", () => {
    const first = new Error("first boom");
    const second = new Error("second boom", { cause: first });
    first.cause = second;

    markReported(first);
    const reported = anchorError(second, format);

    expect(reported).not.toBe(second);
    expect(second.message).toBe("second boom");
  });

  test("should stop at a cause that is not an error", () => {
    const thrown = new Error("top boom", { cause: { message: "plain object" } });

    expect(() => markReported(thrown)).not.toThrow();
  });

  test("should read a message that has no string form as the empty string and walk on to its cause", () => {
    const root = new Error("root boom");
    const middle = new Error("middle boom", { cause: root });
    (middle as { message: unknown }).message = Object.create(null);
    const top = new Error("top boom", { cause: middle });

    expect(() => markReported(top)).not.toThrow();

    const fromMiddle = anchorError(middle, format);

    expect(anchorError(top, format).cause).toBe(top);
    expect(fromMiddle.cause).toBe(middle);
    expect(fromMiddle.message).toBe("anchored: ");
    expect(anchorError(root, format).cause).toBe(root);
  });

  test("should read a message whose getter throws as the empty string and walk on to its cause", () => {
    const root = new Error("root boom");
    const middle = new Error("middle boom", { cause: root });
    Object.defineProperty(middle, "message", {
      get: () => {
        throw new TypeError("message getter boom");
      },
    });
    const top = new Error("top boom", { cause: middle });

    expect(() => markReported(top)).not.toThrow();

    const fromMiddle = anchorError(middle, format);

    expect(anchorError(top, format).cause).toBe(top);
    expect(fromMiddle.cause).toBe(middle);
    expect(fromMiddle.message).toBe("anchored: ");
    expect(anchorError(root, format).cause).toBe(root);
  });

  test.each(unclassifiable)(
    "should end the walk at a cause that is $label, leaving the members already read marked",
    ({ build }) => {
      const top = new Error("top boom", { cause: build() });

      expect(() => markReported(top)).not.toThrow();
      expect(anchorError(top, format).cause).toBe(top);
    },
  );

  test("should end the walk at a cause whose getter throws, leaving the members already read marked", () => {
    const middle = new Error("middle boom");
    Object.defineProperty(middle, "cause", {
      get: () => {
        throw new TypeError("cause getter boom");
      },
    });
    const top = new Error("top boom", { cause: middle });

    expect(() => markReported(top)).not.toThrow();

    const fromMiddle = anchorError(middle, format);

    expect(anchorError(top, format).cause).toBe(top);
    expect(fromMiddle.cause).toBe(middle);
    expect(fromMiddle.message).toBe("anchored: middle boom");
  });

  test.each([
    { label: "undefined", message: undefined, text: "undefined" },
    { label: "an object", message: { code: 42 }, text: "[object Object]" },
  ])(
    "should report an instance whose message is not a string by its string form ($label)",
    ({ message, text }) => {
      const thrown = new Error("replaced");
      (thrown as { message: unknown }).message = message;

      markReported(thrown);
      const reported = anchorError(thrown, format);

      expect(reported).not.toBe(thrown);
      expect(reported.message).toBe(`anchored: ${text}`);
      expect(thrown.message).toBe(message);
    },
  );

  test("should ignore a value that is not an error", () => {
    expect(() => markReported("just a string" as unknown as Error)).not.toThrow();
  });
});
