import { ClientError } from "@lindorm/errors";
import { createConnectionCorsMiddleware } from "./connection-cors-middleware";

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

    await expect(mw(buildCtx(undefined), jest.fn())).rejects.toThrow(ClientError);
  });

  test("should reject handshakes with disallowed origin", async () => {
    const mw = createConnectionCorsMiddleware({
      allowOrigins: ["https://app.example.com"],
    });

    await expect(mw(buildCtx("https://evil.example.com"), jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should accept handshakes with allow-listed origin", async () => {
    const mw = createConnectionCorsMiddleware({
      allowOrigins: ["https://app.example.com"],
    });
    const next = jest.fn().mockResolvedValue(undefined);

    await expect(mw(buildCtx("https://app.example.com"), next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should accept when wildcard is configured", async () => {
    const mw = createConnectionCorsMiddleware({ allowOrigins: "*" });
    const next = jest.fn().mockResolvedValue(undefined);

    await expect(mw(buildCtx("https://any.example.com"), next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
