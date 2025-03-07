import { Environment } from "@lindorm/enums";
import { ClientError } from "@lindorm/errors";
import { randomUUID as _randomUUID } from "crypto";
import MockDate from "mockdate";
import { createHttpMetadataMiddleware } from "./http-metadata-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto");

const randomUUID = _randomUUID as jest.Mock;

describe("createHttpMetadataMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      get: jest.fn(),
      set: jest.fn(),
    };

    options = {
      environment: Environment.Test,
      httpMaxRequestAge: "10s",
      version: "1.0.0",
    };

    ctx.get.mockImplementation((key: string): string => {
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
        default:
          throw new Error(`Unknown key: ${key}`);
      }
    });

    randomUUID.mockReturnValue("2f881f6e-f7ce-554f-a5cd-cb80266ff3ec");
  });

  test("should enrich context with metadata", async () => {
    await expect(
      createHttpMetadataMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.metadata).toEqual({
      correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
      date: MockedDate,
      environment: "test",
      origin: "test-origin",
      requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      responseId: "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
      sessionId: null,
    });

    expect(ctx.set).toHaveBeenCalledWith(
      "x-correlation-id",
      "8b39eafc-7e31-501b-ab7b-58514b14856a",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "x-request-id",
      "aa9a627d-8296-598c-9589-4ec91d27d056",
    );
  });

  test("should enrich context with generated metadata", async () => {
    ctx.get.mockReturnValue("");

    await expect(
      createHttpMetadataMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.metadata).toEqual({
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

  test("should throw error on invalid date (min)", async () => {
    ctx.get.mockImplementation((key: string): any => {
      switch (key) {
        case "date":
          return new Date("2024-01-01T07:00:00.000Z").toISOString();
        default:
          return undefined;
      }
    });

    await expect(createHttpMetadataMiddleware(options)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should return error on invalid date (max)", async () => {
    ctx.get.mockImplementation((key: string): any => {
      switch (key) {
        case "date":
          return new Date("2024-01-01T09:00:00.000Z").toISOString();
        default:
          return undefined;
      }
    });

    await expect(createHttpMetadataMiddleware(options)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
