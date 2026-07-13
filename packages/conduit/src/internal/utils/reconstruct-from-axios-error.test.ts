import { describe, expect, test } from "vitest";
import {
  TEST_BASIC_CREDENTIAL,
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { reconstructFromAxiosError } from "./reconstruct-from-axios-error.js";

const createAxiosError = (overrides: any = {}): any => ({
  message: "Request failed with status code 401",
  code: "ERR_BAD_REQUEST",
  status: 401,
  config: {
    data: JSON.stringify({ client_id: "client_01HZ", client_secret: TEST_PASSWORD }),
    headers: {
      Authorization: `Bearer ${TEST_JWT}`,
      "Content-Type": "application/json",
      DPoP: TEST_JWT,
    },
    method: "post",
    url: "https://api.test.lindorm.io/oauth/token",
  },
  request: {
    header: [
      "POST /oauth/token HTTP/1.1",
      "Host: api.test.lindorm.io",
      `Authorization: Basic ${TEST_BASIC_CREDENTIAL}`,
      "",
      "",
    ].join("\r\n"),
    method: "POST",
    path: "/oauth/token",
  },
  response: {
    data: { error: "invalid_client" },
    headers: { "set-cookie": ["sid=abc123; Path=/; HttpOnly"] },
    status: 401,
    statusText: "Unauthorized",
  },
  ...overrides,
});

describe("reconstructFromAxiosError", () => {
  test("should redact credentials carried in the transport debug payload", () => {
    const err = reconstructFromAxiosError(createAxiosError());
    const { transport } = err.debug as any;

    expect(transport.config.headers).toMatchSnapshot();
    expect(transport.config.data).toMatchSnapshot();
    expect(transport.request.header).toMatchSnapshot();
    expect(transport.response.headers).toMatchSnapshot();

    const serialised = JSON.stringify(err.debug);

    expect(serialised).not.toContain(TEST_JWT_SIGNATURE);
    expect(serialised).not.toContain(TEST_PASSWORD);
    expect(serialised).not.toContain(TEST_BASIC_CREDENTIAL);
  });

  test("should sanitise token fields of the response body", () => {
    const err = reconstructFromAxiosError(
      createAxiosError({
        response: {
          data: { access_token: TEST_JWT, token_type: "Bearer" },
          headers: {},
          status: 400,
          statusText: "Bad Request",
        },
      }),
    );

    expect((err.debug as any).transport.response.data).toMatchSnapshot();
  });

  test("should still detect a pylon error envelope after redaction", () => {
    const err = reconstructFromAxiosError(
      createAxiosError({
        response: {
          data: {
            __meta: {
              app: "Pylon",
              environment: "test",
              name: "tyr",
              version: "1.0.0",
            },
            error: {
              id: "err_01HZ",
              code: "invalid_client",
              data: {},
              message: "Invalid client",
              name: "UnauthorizedError",
              support: "support_01HZ",
              title: "Invalid Client",
              type: "urn:lindorm:tyr:error:invalid_client",
            },
          },
          headers: {},
          status: 401,
          statusText: "Unauthorized",
        },
      }),
    );

    expect(err.message).toEqual("Invalid client");
    expect(err.code).toEqual("invalid_client");
    expect(err.type).toEqual("urn:lindorm:tyr:error:invalid_client");
  });

  test("should produce a network error without a status", () => {
    const err = reconstructFromAxiosError(
      createAxiosError({ status: undefined, response: undefined }),
    );

    expect(err.name).toEqual("NetworkError");
    expect(JSON.stringify(err.debug)).not.toContain(TEST_PASSWORD);
  });
});
