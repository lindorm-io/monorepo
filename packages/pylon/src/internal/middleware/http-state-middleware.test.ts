import { randomUUID as _randomUUID } from "crypto";
import MockDate from "mockdate";
import { getAuthorization as _getAuthorization } from "../utils/get-authorization";
import { createHttpStateMiddleware } from "./http-state-middleware";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("crypto");
vi.mock("../utils/get-authorization");

const randomUUID = _randomUUID as Mock;
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

    randomUUID.mockReturnValue("2f881f6e-f7ce-554f-a5cd-cb80266ff3ec");
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
      responseId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
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
      id: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
      correlationId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
      date: MockedDate,
      environment: "unknown",
      origin: null,
      responseId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
      sessionId: null,
    });

    expect(ctx.set).toHaveBeenCalledWith(
      "x-correlation-id",
      "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "x-request-id",
      "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
    );
    expect(ctx.set).toHaveBeenCalledWith("x-server-environment", "test");
    expect(ctx.set).toHaveBeenCalledWith("x-server-version", "1.0.0");
  });
});
