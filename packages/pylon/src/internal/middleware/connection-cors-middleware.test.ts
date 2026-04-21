import { ClientError } from "@lindorm/errors";
import { createConnectionCorsMiddleware } from "./connection-cors-middleware";
import { describe, expect, test, vi } from "vitest";

const buildCtx = (origin: string | undefined): any => ({
  io: {
    socket: {
      handshake: {
        headers: origin === undefined ? {} : { origin },
      },
    },
  },
});

describe("createConnectionCorsMiddleware", () => {
  test("should throw at construction when '*' combined with allowCredentials", () => {
    expect(() =>
      createConnectionCorsMiddleware({ allowOrigins: "*", allowCredentials: true }),
    ).toThrow("Cannot set allowCredentials to true when allowOrigins is set to *");
  });

  test("should reject handshakes missing Origin header", async () => {
    const mw = createConnectionCorsMiddleware({
      allowOrigins: ["https://app.example.com"],
    });

    await expect(mw(buildCtx(undefined), vi.fn())).rejects.toThrow(ClientError);
  });

  test("should reject handshakes with disallowed origin", async () => {
    const mw = createConnectionCorsMiddleware({
      allowOrigins: ["https://app.example.com"],
    });

    await expect(mw(buildCtx("https://evil.example.com"), vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should accept handshakes with allow-listed origin", async () => {
    const mw = createConnectionCorsMiddleware({
      allowOrigins: ["https://app.example.com"],
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await expect(mw(buildCtx("https://app.example.com"), next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should accept when wildcard is configured", async () => {
    const mw = createConnectionCorsMiddleware({ allowOrigins: "*" });
    const next = vi.fn().mockResolvedValue(undefined);

    await expect(mw(buildCtx("https://any.example.com"), next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
