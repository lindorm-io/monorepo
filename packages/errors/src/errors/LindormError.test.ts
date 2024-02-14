import { ExtendableError } from "./ExtendableError";
import { LindormError } from "./LindormError";

class ExternalError extends Error {
  constructor(
    public readonly code: string,
    public readonly something: string,
    public readonly config: any,
  ) {
    super("external error message");
  }
}

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

    const externalError = new ExternalError("external code", "something fun", {
      configuration: 1,
      string: "string",
    });

    const extendsError = new LindormError("lindormError", {
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
          trace: ["Error: error"],
        }),
      );
    });

    test("should inherit values from lindorm errors", () => {
      expect(new LindormError("message", { error: extendsError })).toStrictEqual(
        expect.objectContaining({
          code: "code",
          data: { value: "data" },
          debug: { value: "debug" },
          description: "description",
          parents: [
            { message: "error", name: "Error" },
            {
              code: "code",
              data: { value: "data" },
              debug: { value: "debug" },
              description: "description",
              message: "lindormError",
              name: "LindormError",
              title: "title",
            },
          ],
          title: "title",
          trace: ["Error: error", "LindormError: lindormError"],
        }),
      );
    });

    test("should inherit values from any errors", () => {
      expect(new LindormError("message", { error: externalError })).toStrictEqual(
        expect.objectContaining({
          code: "external code",
          parents: [
            {
              code: "external code",
              message: "external error message",
              name: "ExternalError",
              something: "something fun",
              config: {
                configuration: 1,
                string: "string",
              },
            },
          ],
          trace: ["ExternalError: external error message"],
        }),
      );
    });
  });
});
