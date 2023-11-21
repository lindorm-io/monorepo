import { metadataMiddleware } from "./metadata-middleware";

jest.mock("crypto", () => ({
  randomUUID: jest.fn().mockImplementation(() => "a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

const next = () => Promise.resolve();

describe("metadataMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      get: jest.fn((name) => name),
      set: jest.fn(),

      userAgent: {
        browser: "browser",
        geoIp: { geoIp: 1 },
        os: "os",
        platform: "platform",
        source: "source",
        version: "version",
      },
    };
  });

  test("should use values from headers if they exist", async () => {
    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.metadata).toStrictEqual({
      agent: {
        browser: "x-agent-browser",
        geoIp: "x-agent-geo-ip",
        os: "x-agent-os",
        platform: "x-agent-platform",
        source: "x-agent-source",
        version: "x-agent-version",
      },
      correlationId: "x-correlation-id",
      requestId: "x-request-id",
    });
  });

  test("should use agent data from header", async () => {
    ctx.get = jest.fn((): void => {});

    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.metadata).toStrictEqual(
      expect.objectContaining({
        agent: {
          browser: "browser",
          geoIp: '{"geoIp":1}',
          os: "os",
          platform: "platform",
          source: "source",
          version: "version",
        },
      }),
    );
  });

  test("should use default values if header is missing", async () => {
    ctx.get = jest.fn((): void => {});
    ctx.userAgent = {};

    await expect(metadataMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.metadata).toStrictEqual({
      agent: {
        browser: undefined,
        geoIp: undefined,
        os: undefined,
        platform: undefined,
        source: undefined,
        version: undefined,
      },
      correlationId: "a26dad28-e854-447d-bce6-5c685cddfea8",
      requestId: "a26dad28-e854-447d-bce6-5c685cddfea8",
    });
  });
});
