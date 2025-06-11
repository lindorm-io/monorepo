import { Environment } from "@lindorm/enums";
import { randomUUID as _randomUUID } from "crypto";
import MockDate from "mockdate";
import { getAuthorization as _getAuthorization } from "../../utils/private";
import { createHttpStateMiddleware } from "./http-state-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto");
jest.mock("../../utils/private");

const randomUUID = _randomUUID as jest.Mock;
const getAuthorization = _getAuthorization as jest.Mock;

describe("createHttpStateMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      get: jest.fn(),
      set: jest.fn(),
    };

    options = {
      environment: Environment.Test,
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
      createHttpStateMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.metadata).toEqual({
      correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
      date: MockedDate,
      environment: "test",
      origin: "test-origin",
      requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
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
      createHttpStateMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.metadata).toEqual({
      correlationId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
      date: MockedDate,
      environment: "unknown",
      origin: null,
      requestId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
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
