import { ClientError } from "@lindorm-io/errors";
import MockDate from "mockdate";
import { metadataMiddleware } from "./metadata-middleware";

MockDate.set("2020-01-01T08:00:00.000");

jest.mock("crypto", () => ({
  randomUUID: jest.fn().mockImplementation(() => "a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

const next = () => Promise.resolve();

describe("metadataMiddleware", () => {
  let ctx: any;
  let correlationId: string;
  let requestId: string;
  let date: string;

  beforeEach(() => {
    correlationId = "eeab3c94-986b-4a75-bc7d-350c7527189f";
    requestId = "3a91eb0f-a447-4dbf-94cb-61bea760f6ac";
    date = new Date("2020-01-01T07:59:50.000").toUTCString();

    ctx = {
      get: jest.fn((name) => {
        switch (name) {
          case "x-correlation-id":
            return correlationId;
          case "x-request-id":
            return requestId;
          case "date":
            return date;
          default:
            return name;
        }
      }),
      set: jest.fn(),
    };
  });

  test("should use values from headers if they exist", async () => {
    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.metadata).toStrictEqual({
      correlationId,
      date: new Date(date),
      requestId,
    });
  });

  test("should set headers", async () => {
    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("X-Correlation-ID", correlationId);
    expect(ctx.set).toHaveBeenCalledWith("X-Request-ID", requestId);
    expect(ctx.set).toHaveBeenCalledWith("Date", new Date().toUTCString());
  });

  test("should use default values if header is missing", async () => {
    ctx.get = jest.fn((): void => {});

    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.metadata).toStrictEqual({
      correlationId: "a26dad28-e854-447d-bce6-5c685cddfea8",
      date: new Date("2020-01-01T08:00:00.000Z"),
      requestId: "a26dad28-e854-447d-bce6-5c685cddfea8",
    });
  });

  test("should throw on invalid correlation id", async () => {
    ctx.get = jest.fn((name) => {
      switch (name) {
        case "x-correlation-id":
          return "INVALID";
        case "x-request-id":
          return requestId;
        case "date":
          return date;
        default:
          return name;
      }
    });

    await expect(metadataMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid request id", async () => {
    ctx.get = jest.fn((name) => {
      switch (name) {
        case "x-correlation-id":
          return correlationId;
        case "x-request-id":
          return "INVALID";
        case "date":
          return date;
        default:
          return name;
      }
    });

    await expect(metadataMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid date", async () => {
    ctx.get = jest.fn((name) => {
      switch (name) {
        case "x-correlation-id":
          return correlationId;
        case "x-request-id":
          return requestId;
        case "date":
          return new Date("2020-01-01T07:59:49.000").toUTCString();
        default:
          return name;
      }
    });

    await expect(metadataMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
