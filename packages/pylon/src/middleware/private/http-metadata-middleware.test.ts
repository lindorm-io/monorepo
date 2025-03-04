import { Environment } from "@lindorm/enums";
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
    });

    expect(ctx.set).toHaveBeenCalledWith(
      "X-Correlation-ID",
      "8b39eafc-7e31-501b-ab7b-58514b14856a",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "X-Request-ID",
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
    });

    expect(ctx.set).toHaveBeenCalledWith(
      "X-Correlation-ID",
      "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
    );
    expect(ctx.set).toHaveBeenCalledWith(
      "X-Request-ID",
      "2f881f6e-f7ce-554f-a5cd-cb80266ff3ec",
    );
    expect(ctx.set).toHaveBeenCalledWith("X-Server-Environment", "test");
    expect(ctx.set).toHaveBeenCalledWith("X-Server-Version", "1.0.0");
  });

  test("should return error on invalid date (min)", async () => {
    ctx.get.mockImplementation((key: string): any => {
      switch (key) {
        case "date":
          return new Date("2024-01-01T07:00:00.000Z").toISOString();
        default:
          return undefined;
      }
    });

    await expect(
      createHttpMetadataMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.status).toEqual(400);
    expect(ctx.body).toStrictEqual({
      error: {
        code: "replay_error",
        data: {
          actual: "2024-01-01T07:00:00.000Z",
          expect: "2024-01-01T07:59:50.000Z",
        },
        message: "Request has been identified as a likely replay attack",
        name: "ClientError",
        title: "Bad Request",
      },
    });
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

    await expect(
      createHttpMetadataMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.status).toEqual(400);
    expect(ctx.body).toStrictEqual({
      error: {
        code: "suspicious_request",
        data: {
          actual: "2024-01-01T09:00:00.000Z",
          expect: "2024-01-01T08:00:10.000Z",
        },
        message: "Request has been identified as suspicious",
        name: "ClientError",
        title: "Bad Request",
      },
    });
  });
});
