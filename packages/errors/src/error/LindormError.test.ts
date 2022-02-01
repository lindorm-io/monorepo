import { ExtendableError } from "./ExtendableError";
import { LindormError } from "./LindormError";

describe("LindormError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new LindormError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendableError", () => {
      expect(new LindormError("message")).toStrictEqual(expect.any(ExtendableError));
    });

    test("should be an LindormError", () => {
      expect(new LindormError("message").name).toBe("LindormError");
    });
  });

  describe("options", () => {
    test("should set options", () => {
      expect(
        new LindormError("message", {
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          description: "description",
          title: "title",
        }),
      ).toStrictEqual(
        expect.objectContaining({
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          description: "description",
          title: "title",
        }),
      );
    });
  });

  describe("inheritance", () => {
    const error = new Error("error");
    const lindormError = new LindormError("lindormError", {
      error,
      code: "code",
      data: { value: "data" },
      debug: { value: "debug" },
      description: "description",
      title: "title",
    });

    test("should store normal error on context", () => {
      expect(new LindormError("message", { error })).toStrictEqual(
        expect.objectContaining({
          errors: [error],
          trace: ["Error: error"],
        }),
      );
    });

    test("should store lindormError error on context", () => {
      expect(new LindormError("message", { error: lindormError })).toStrictEqual(
        expect.objectContaining({
          errors: [error, lindormError],
          trace: ["Error: error", "LindormError: lindormError"],
        }),
      );
    });

    test("should inherit values from extendable errors", () => {
      expect(new LindormError("message", { error: lindormError })).toStrictEqual(
        expect.objectContaining({
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          description: "description",
          title: "title",
        }),
      );
    });
  });
});
