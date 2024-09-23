import { Environment } from "@lindorm/enums";
import { randomUUID as _randomUUID } from "crypto";
import MockDate from "mockdate";
import { createHttpMetadataMiddleware } from "./http-metadata-middleware";

MockDate.set("2024-01-01T10:00:00.000Z");

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
      version: "1.0.0",
    };

    ctx.get.mockImplementation((key: string): string => {
      switch (key) {
        case "date":
          return "2024-01-01T08:00:00.000Z";
        case "x-correlation-id":
          return "8b39eafc-7e31-501b-ab7b-58514b14856a";
        case "x-environment":
          return "test";
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
      date: new Date("2024-01-01T08:00:00.000Z"),
      environment: "test",
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
      date: new Date("2024-01-01T10:00:00.000Z"),
      environment: "unknown",
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
});
