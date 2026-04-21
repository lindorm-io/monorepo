import type { Socket } from "socket.io-client";
import { resolveHandshakeHtu } from "./resolve-handshake-htu.js";
import { describe, expect, it } from "vitest";

type FakeManager = { uri?: string; opts?: { path?: string } };

const makeSocket = (manager: FakeManager): Socket =>
  ({ io: manager }) as unknown as Socket;

describe("resolveHandshakeHtu", () => {
  it("should produce default https origin with default /socket.io/ path", () => {
    const socket = makeSocket({ uri: "https://api.example.com" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/socket.io/");
  });

  it("should convert wss:// scheme to https://", () => {
    const socket = makeSocket({ uri: "wss://api.example.com" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/socket.io/");
  });

  it("should convert ws:// scheme to http://", () => {
    const socket = makeSocket({ uri: "ws://api.example.com" });
    expect(resolveHandshakeHtu(socket)).toBe("http://api.example.com/socket.io/");
  });

  it("should use a custom path from manager opts", () => {
    const socket = makeSocket({
      uri: "https://api.example.com",
      opts: { path: "/ws" },
    });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/ws/");
  });

  it("should preserve custom path that already has a trailing slash", () => {
    const socket = makeSocket({
      uri: "https://api.example.com",
      opts: { path: "/ws/" },
    });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/ws/");
  });

  it("should preserve non-default port", () => {
    const socket = makeSocket({ uri: "https://api.example.com:8080" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com:8080/socket.io/");
  });

  it("should strip default https port 443", () => {
    const socket = makeSocket({ uri: "https://api.example.com:443" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/socket.io/");
  });

  it("should strip default http port 80", () => {
    const socket = makeSocket({ uri: "http://api.example.com:80" });
    expect(resolveHandshakeHtu(socket)).toBe("http://api.example.com/socket.io/");
  });

  it("should lowercase scheme and host", () => {
    const socket = makeSocket({ uri: "HTTPS://API.EXAMPLE.COM" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/socket.io/");
  });

  it("should strip the query string from a custom path", () => {
    const socket = makeSocket({
      uri: "https://api.example.com",
      opts: { path: "/ws?token=secret" },
    });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/ws/");
  });

  it("should ignore the namespace on the manager uri", () => {
    const socket = makeSocket({ uri: "https://api.example.com/chat" });
    expect(resolveHandshakeHtu(socket)).toBe("https://api.example.com/socket.io/");
  });

  it("should throw when the manager uri is missing", () => {
    const socket = makeSocket({});
    expect(() => resolveHandshakeHtu(socket)).toThrow("Unable to resolve DPoP htu");
  });
});
