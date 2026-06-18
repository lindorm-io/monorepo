import { randomId as _randomId } from "@lindorm/random";
import MockDate from "mockdate";
import { getAuthorization as _getAuthorization } from "../utils/get-authorization.js";
import { createHttpStateMiddleware } from "./http-state-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("@lindorm/random");
vi.mock("../utils/get-authorization.js");

const randomId = _randomId as Mock;
const getAuthorization = _getAuthorization as Mock;

describe("createHttpStateMiddleware", async () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      get: vi.fn(),
      set: vi.fn(),
      protocol: "https",
      host: "test.lindorm.io",
      request: { origin: "https://test.lindorm.io" },
    };

    options = {
      environment: "test",
      name: "test_name",
      minRequestAge: "10s",
      maxRequestAge: "10s",
      version: "1.0.0",
    };

    ctx.get.mockImplementation((key: string): string | null => {
      switch (key) {
        case "date":
          return MockedDate.toISOString();
        case "x-correlation-id":
          return "8b39eafc-7e31-501b-ab7b-58514b14856a";
        case "x-environment":
          return "test";
        case "x-origin":
          return "test-origin";
        case "x-request-id":
          return "aa9a627d-8296-598c-9589-4ec91d27d056";
        case "x-session-id":
          return "d8a044f5-5b49-5456-829a-b57b44caa785";
        default:
          return null;
      }
    });

    randomId.mockImplementation(
      ({ namespace }: { namespace: string }) => `${namespace}_0000000000000000`,
    );
    getAuthorization.mockReturnValue({ type: "Bearer", value: "token" });
  });

  test("should enrich context with metadata", async () => {
    await expect(
      createHttpStateMiddleware(options)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.metadata).toEqual({
      id: "aa9a627d-8296-598c-9589-4ec91d27d056",
      correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
      date: MockedDate,
      environment: "test",
      origin: "test-origin",
      responseId: "res_0000000000000000",
      sessionId: "d8a044f5-5b49-5456-829a-b57b44caa785",
    });

    expect(ctx.set).toHaveBeenCalledWith(
      "x-correlation-id",
      "8b39eafc-7e31-501b-ab7b-58514b14856a",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "x-request-id",
      "aa9a627d-8296-598c-9589-4ec91d27d056",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "x-session-id",
      "d8a044f5-5b49-5456-829a-b57b44caa785",
    );
  });

  test("should enrich context with generated metadata", async () => {
    ctx.get.mockReturnValue("");

    await expect(
      createHttpStateMiddleware(options)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.metadata).toEqual({
      id: "req_0000000000000000",
      correlationId: "cor_0000000000000000",
      date: MockedDate,
      environment: "unknown",
      origin: null,
      responseId: "res_0000000000000000",
      sessionId: null,
    });

    expect(ctx.set).toHaveBeenCalledWith("x-correlation-id", "cor_0000000000000000");
    expect(ctx.set).toHaveBeenCalledWith("x-request-id", "req_0000000000000000");
    expect(ctx.set).toHaveBeenCalledWith("x-server-environment", "test");
    expect(ctx.set).toHaveBeenCalledWith("x-server-version", "1.0.0");
  });
});
