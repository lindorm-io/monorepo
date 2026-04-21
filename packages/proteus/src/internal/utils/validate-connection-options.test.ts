import { validateConnectionMutualExclusivity } from "./validate-connection-options.js";
import { describe, expect, it } from "vitest";

describe("validateConnectionMutualExclusivity", () => {
  it("should not throw when only url is provided", () => {
    expect(() =>
      validateConnectionMutualExclusivity({ url: "postgres://localhost/db" }),
    ).not.toThrow();
  });

  it("should not throw when only individual fields are provided", () => {
    expect(() =>
      validateConnectionMutualExclusivity({
        host: "localhost",
        port: 5432,
        user: "admin",
        password: "secret",
      }),
    ).not.toThrow();
  });

  it("should not throw when no fields are provided", () => {
    expect(() => validateConnectionMutualExclusivity({})).not.toThrow();
  });

  it("should throw when url and host are both provided", () => {
    expect(() =>
      validateConnectionMutualExclusivity({
        url: "postgres://localhost/db",
        host: "localhost",
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining("mutually exclusive"),
      }),
    );
  });

  it("should throw when url and multiple individual fields are provided", () => {
    expect(() =>
      validateConnectionMutualExclusivity({
        url: "postgres://localhost/db",
        host: "localhost",
        port: 5432,
        user: "admin",
        password: "secret",
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining("host, port, user, password"),
      }),
    );
  });

  it("should list all conflicting fields in the error message", () => {
    expect(() =>
      validateConnectionMutualExclusivity({
        url: "redis://localhost",
        user: "admin",
        password: "secret",
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining("user, password"),
      }),
    );
  });
});
