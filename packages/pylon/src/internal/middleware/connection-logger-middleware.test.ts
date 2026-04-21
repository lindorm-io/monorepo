import { connectionLoggerMiddleware } from "./connection-logger-middleware";
import { describe, expect, test, vi } from "vitest";

describe("connectionLoggerMiddleware", () => {
  test("should log handshake received and resolved", async () => {
    const info = vi.fn();
    const ctx: any = {
      io: { socket: { id: "socket-123" } },
      logger: { info },
    };

    await connectionLoggerMiddleware(ctx, vi.fn().mockResolvedValue(undefined));

    expect(info).toHaveBeenCalledWith("Socket handshake received", {
      socketId: "socket-123",
    });
    expect(info).toHaveBeenCalledWith(
      "Socket handshake resolved",
      expect.objectContaining({ socketId: "socket-123", time: expect.any(Number) }),
    );
  });

  test("should tolerate missing logger", async () => {
    const ctx: any = { io: { socket: { id: "socket-456" } } };
    await expect(
      connectionLoggerMiddleware(ctx, vi.fn().mockResolvedValue(undefined)),
    ).resolves.toBeUndefined();
  });
});
