import MockDate from "mockdate";
import { LindormError } from "./LindormError";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

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

  describe("serialisation", () => {
    test("should serialise to string", () => {
      expect(new LindormError("message").toString()).toEqual("LindormError: message");
    });

    test("should serialise to json", () => {
      expect(
        new LindormError("message", {
          id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
          code: "custom_code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          status: 999,
          support: "56d82695bdbb3aab55ef",
          title: "title",
        }).toJSON(),
      ).toEqual({
        code: "custom_code",
        data: { value: "data" },
        debug: { value: "debug" },
        details: "details",
        errors: [],
        id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
        message: "message",
        name: "LindormError",
        stack: expect.stringContaining("LindormError: message"),
        status: 999,
        support: "56d82695bdbb3aab55ef",
        timestamp: new Date("2024-01-01T08:00:00.000Z"),
        title: "title",
      });
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

    test("should set numeric code", () => {
      expect(
        new LindormError("message", {
          code: -11000,
        }),
      ).toEqual(
        expect.objectContaining({
          code: -11000,
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
