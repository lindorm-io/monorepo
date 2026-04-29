import MockDate from "mockdate";
import { LindormError } from "./LindormError.js";
import { NetworkError } from "./NetworkError.js";
import { describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("NetworkError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new NetworkError("network down")).toEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new NetworkError("network down")).toEqual(expect.any(LindormError));
    });

    test("should be a NetworkError", () => {
      expect(new NetworkError("network down")).toEqual(expect.any(NetworkError));
    });

    test("should set name to NetworkError", () => {
      expect(new NetworkError("network down").name).toEqual("NetworkError");
    });
  });

  describe("options", () => {
    test("should set status to -1", () => {
      expect(new NetworkError("network down").status).toEqual(-1);
    });

    test("should ignore caller-supplied status overrides", () => {
      expect(
        new NetworkError("network down", { ...({ status: 502 } as any) }).status,
      ).toEqual(-1);
    });

    test("should accept custom message", () => {
      expect(new NetworkError("custom").message).toEqual("custom");
    });

    test("should accept title", () => {
      expect(new NetworkError("m", { title: "Network Failure" }).title).toEqual(
        "Network Failure",
      );
    });
  });

  describe("serialisation", () => {
    test("should serialise to json with default values", () => {
      expect(
        new NetworkError("message", {
          id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
        }).toJSON(),
      ).toMatchSnapshot({
        stack: expect.stringContaining("NetworkError: message"),
      });
    });

    test("should serialise to json with custom options", () => {
      expect(
        new NetworkError("message", {
          id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
          code: "custom_code",
          data: { value: "data" },
          debug: { value: "debug" },
          details: "details",
          support: "56d82695bdbb3aab55ef",
          title: "title",
        }).toJSON(),
      ).toMatchSnapshot({
        stack: expect.stringContaining("NetworkError: message"),
      });
    });
  });
});
