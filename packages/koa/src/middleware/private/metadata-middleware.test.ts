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
      client: {
        id: "x-client-id",
        environment: "x-client-environment",
        platform: "x-client-platform",
        version: "x-client-version",
      },
      device: {
        installationId: "x-device-installation-id",
        ip: "x-device-ip",
        linkId: "x-device-link-id",
        name: "x-device-name",
        systemVersion: "x-device-system-version",
        uniqueId: "x-device-unique-id",
      },
      identifiers: {
        correlationId: "x-correlation-id",
        fingerprint: "x-fingerprint",
      },
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
        browser: null,
        geoIp: null,
        os: null,
        platform: null,
        source: null,
        version: null,
      },
      client: {
        environment: "unknown",
        id: null,
        platform: null,
        version: null,
      },
      device: {
        installationId: null,
        ip: null,
        linkId: null,
        name: null,
        systemVersion: null,
        uniqueId: null,
      },
      identifiers: {
        correlationId: "a26dad28-e854-447d-bce6-5c685cddfea8",
        fingerprint: null,
      },
    });
  });
});
