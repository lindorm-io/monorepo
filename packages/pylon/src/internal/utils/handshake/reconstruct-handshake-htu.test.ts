import { reconstructHandshakeHtu } from "./reconstruct-handshake-htu";
import { describe, expect, test } from "vitest";

describe("reconstructHandshakeHtu", () => {
  test("returns origin + path from secure handshake", () => {
    expect(
      reconstructHandshakeHtu({
        secure: true,
        headers: { host: "api.example.com" },
        url: "/socket.io/?EIO=4&transport=websocket",
      }),
    ).toMatchSnapshot();
  });

  test("strips query string from url", () => {
    const result = reconstructHandshakeHtu({
      secure: true,
      headers: { host: "api.example.com" },
      url: "/socket.io/?token=abc",
    });
    expect(result?.path).toBe("/socket.io/");
  });

  test("preserves trailing slash", () => {
    const result = reconstructHandshakeHtu({
      secure: true,
      headers: { host: "api.example.com" },
      url: "/ws/",
    });
    expect(result?.path).toBe("/ws/");
  });

  test("uses x-forwarded-proto and x-forwarded-host when present", () => {
    expect(
      reconstructHandshakeHtu({
        secure: false,
        headers: {
          host: "internal:8080",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.example.com",
        },
        url: "/socket.io/",
      }),
    ).toMatchSnapshot();
  });

  test("returns undefined when host header is missing", () => {
    expect(
      reconstructHandshakeHtu({
        secure: true,
        headers: {},
        url: "/socket.io/",
      }),
    ).toBeUndefined();
  });

  test("strips default port 443 for https", () => {
    const result = reconstructHandshakeHtu({
      secure: true,
      headers: { host: "api.example.com:443" },
      url: "/socket.io/",
    });
    expect(result?.origin).toBe("https://api.example.com");
  });

  test("defaults to root path when url is empty", () => {
    const result = reconstructHandshakeHtu({
      secure: true,
      headers: { host: "api.example.com" },
      url: "",
    });
    expect(result?.path).toBe("/");
  });
});
