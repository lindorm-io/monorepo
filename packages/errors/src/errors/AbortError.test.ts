import MockDate from "mockdate";
import { AbortError } from "./AbortError.js";
import { LindormError } from "./LindormError.js";
import { describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("AbortError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new AbortError()).toEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new AbortError()).toEqual(expect.any(LindormError));
    });

    test("should be an AbortError", () => {
      expect(new AbortError()).toEqual(expect.any(AbortError));
    });

    test("should set name to AbortError", () => {
      expect(new AbortError().name).toEqual("AbortError");
    });
  });

  describe("options", () => {
    test("should use default message and status 499", () => {
      const err = new AbortError();

      expect(err.message).toEqual("Operation aborted");
      expect(err.status).toEqual(499);
      expect(err.title).toEqual("Client Closed Request");
      expect(err.reason).toBeUndefined();
    });

    test("should accept custom message", () => {
      expect(new AbortError("custom").message).toEqual("custom");
    });

    test("should allow status override", () => {
      expect(new AbortError("m", { status: 408 }).status).toEqual(408);
    });

    test("should allow title override", () => {
      expect(new AbortError("m", { title: "custom title" }).title).toEqual(
        "custom title",
      );
    });
  });

  describe("reason", () => {
    test("should carry primitive reason", () => {
      expect(new AbortError("m", { reason: "timeout" }).reason).toEqual("timeout");
    });

    test("should carry object reason", () => {
      const reason = { code: "ETIMEDOUT", detail: "upstream" };

      expect(new AbortError("m", { reason }).reason).toEqual(reason);
    });

    test("should carry Error reason", () => {
      const reason = new Error("cause");

      expect(new AbortError("m", { reason }).reason).toBe(reason);
    });
  });

  describe("serialisation", () => {
    test("should serialise to json with default values", () => {
      expect(
        new AbortError("message", {
          id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
        }).toJSON(),
      ).toMatchSnapshot({
        stack: expect.stringContaining("AbortError: message"),
      });
    });

    test("should serialise to json with custom options", () => {
      expect(
        new AbortError("message", {
          id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
          code: "custom_code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          support: "56d82695bdbb3aab55ef",
          title: "title",
        }).toJSON(),
      ).toMatchSnapshot({
        stack: expect.stringContaining("AbortError: message"),
      });
    });
  });
});
