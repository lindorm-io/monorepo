import { ClientError } from "@lindorm/errors";
import { extractHandshakeAccessTokenInput } from "./extract-handshake-access-token-input.js";
import { describe, expect, test } from "vitest";

const makeSocket = (overrides: any = {}): any => ({
  handshake: { auth: {}, headers: {}, ...overrides.handshake },
  data: overrides.data ?? {},
});

describe("extractHandshakeAccessTokenInput", () => {
  test("returns bearer input when only bearer is present", () => {
    const socket = makeSocket({ handshake: { auth: { bearer: "jwt" } } });
    expect(extractHandshakeAccessTokenInput(socket)).toMatchSnapshot();
  });

  test("returns dpop input when bearer + dpop header present", () => {
    const socket = makeSocket({
      handshake: { auth: { bearer: "jwt" }, headers: { dpop: "proof" } },
    });
    expect(extractHandshakeAccessTokenInput(socket)).toMatchSnapshot();
  });

  test("throws ClientError when no token source present", () => {
    expect(() => extractHandshakeAccessTokenInput(makeSocket())).toThrow(ClientError);
  });

  test("throws ClientError when only session present", () => {
    const socket = makeSocket({ data: { session: { accessToken: "x" } } });
    expect(() => extractHandshakeAccessTokenInput(socket)).toThrow(ClientError);
  });
});
