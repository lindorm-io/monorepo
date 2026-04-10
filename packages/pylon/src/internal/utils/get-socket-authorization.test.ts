import { getSocketAuthorization } from "./get-socket-authorization";

describe("getSocketAuthorization", () => {
  test("should return bearer authorization from auth.token", () => {
    const socket: any = {
      handshake: { auth: { token: "Bearer abc123" }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return basic authorization from auth.token", () => {
    const socket: any = {
      handshake: { auth: { token: "Basic dXNlcjpwYXNz" }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return dpop authorization from auth.token", () => {
    const socket: any = {
      handshake: { auth: { token: "DPoP proof-token" }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should fall back to headers.authorization when auth.token is absent", () => {
    const socket: any = {
      handshake: { auth: {}, headers: { authorization: "Bearer xyz789" } },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when auth string has unknown type", () => {
    const socket: any = {
      handshake: { auth: { token: "Digest abc123" }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when auth string has no value after type", () => {
    const socket: any = {
      handshake: { auth: { token: "Bearer " }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when auth string is only the type", () => {
    const socket: any = {
      handshake: { auth: { token: "Bearer" }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when auth is not a string", () => {
    const socket: any = {
      handshake: { auth: { token: 12345 }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when auth is null", () => {
    const socket: any = {
      handshake: { auth: { token: null }, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });

  test("should return default when handshake has no auth or headers", () => {
    const socket: any = {
      handshake: { auth: {}, headers: {} },
    };

    expect(getSocketAuthorization(socket)).toMatchSnapshot();
  });
});
