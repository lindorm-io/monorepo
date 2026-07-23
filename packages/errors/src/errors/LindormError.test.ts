import MockDate from "mockdate";
import { LindormError } from "./LindormError.js";
import { describe, expect, test } from "vitest";

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
        lineage: ["LindormError"],
        id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
        message: "message",
        name: "LindormError",
        stack: expect.stringContaining("LindormError: message"),
        status: 999,
        support: "56d82695bdbb3aab55ef",
        timestamp: new Date("2024-01-01T08:00:00.000Z"),
        title: "title",
        type: "urn:lindorm:error:custom_code",
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

    test("should auto-generate a readable support code when none is provided", () => {
      // MockDate is frozen to 2024-01-01 (UTC) → "A01-" prefix; the two groups
      // are random from the unambiguous alphabet.
      expect(new LindormError("message").support).toMatch(
        /^A01-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/,
      );
    });

    test("should keep an explicitly provided support code", () => {
      expect(new LindormError("message", { support: "CUSTOM-01" }).support).toBe(
        "CUSTOM-01",
      );
    });
  });

  describe("lineage", () => {
    class LevelOneError extends LindormError {}
    class LevelTwoError extends LevelOneError {}
    class LevelThreeError extends LevelTwoError {}

    test("should be just LindormError for the base class", () => {
      expect(new LindormError("message").lineage).toEqual(["LindormError"]);
    });

    test("should capture the full class-ancestry chain leaf-first", () => {
      expect(new LevelThreeError("message").lineage).toEqual([
        "LevelThreeError",
        "LevelTwoError",
        "LevelOneError",
        "LindormError",
      ]);
    });

    test("should stop at LindormError even for a shallow subclass", () => {
      expect(new LevelOneError("message").lineage).toEqual([
        "LevelOneError",
        "LindormError",
      ]);
    });

    test("should surface lineage in toJSON", () => {
      expect(new LevelTwoError("message").toJSON().lineage).toEqual([
        "LevelTwoError",
        "LevelOneError",
        "LindormError",
      ]);
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
