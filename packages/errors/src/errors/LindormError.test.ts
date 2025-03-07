import { LindormError } from "./LindormError";

class ExternalError extends Error {
  constructor(message: string) {
    super(message);
  }
}

describe("LindormError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new LindormError("message")).toEqual(expect.any(Error));
    });

    test("should be an LindormError", () => {
      expect(new LindormError("message").name).toEqual("LindormError");
    });
  });

  describe("options", () => {
    test("should set options", () => {
      expect(
        new LindormError("message", {
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          title: "title",
        }),
      ).toEqual(
        expect.objectContaining({
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          title: "title",
        }),
      );
    });
  });

  describe("inheritance", () => {
    const error = new Error("error message");

    const externalError = new ExternalError("external error message");

    const extendsError = new LindormError("lindorm error message", {
      error,
      code: "code",
      data: { value: "data" },
      debug: { value: "debug" },
      details: "details",
      title: "title",
    });

    test("should store normal error on context", () => {
      expect(new LindormError("message", { error })).toEqual(
        expect.objectContaining({
          errors: ["Error: error message"],
        }),
      );
    });

    test("should inherit values from lindorm errors", () => {
      expect(new LindormError("message", { error: extendsError })).toEqual(
        expect.objectContaining({
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          title: "title",
          errors: ["Error: error message", "LindormError: lindorm error message"],
        }),
      );
    });

    test("should inherit values from any errors", () => {
      expect(new LindormError("message", { error: externalError })).toEqual(
        expect.objectContaining({
          errors: ["ExternalError: external error message"],
        }),
      );
    });
  });
});
