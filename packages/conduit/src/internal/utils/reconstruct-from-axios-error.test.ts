import {
  ClientError,
  errorRegistry,
  NotFoundError,
  ServerError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import {
  TEST_BASIC_CREDENTIAL,
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { reconstructFromAxiosError } from "./reconstruct-from-axios-error.js";

/**
 * A service's own error: a 400 like a dozen others, distinguishable only by name. Registering
 * it is what lets a caller reconstruct it and catch it with `instanceof`.
 */
class InvalidFirstNameSchemaError extends ClientError {
  public static readonly status = 400;

  public constructor(message: string, options = {}) {
    super(message, { ...options, status: 400 });
  }
}

errorRegistry.register(InvalidFirstNameSchemaError);

const createPylonError = (error: any): any => ({
  __meta: { app: "Pylon", environment: "test", name: "tyr", version: "1.0.0" },
  error: {
    id: "err_01HZ",
    code: "invalid_client",
    data: {},
    message: "Invalid client",
    name: "UnauthorizedError",
    support: "support_01HZ",
    title: "Invalid Client",
    ...error,
  },
});

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
    expect(err.title).toEqual("Network Error");
    expect(JSON.stringify(err.debug)).not.toContain(TEST_PASSWORD);
  });

  describe("pylon upstream", () => {
    test("should reconstruct a service's own error by name, catchable with instanceof", () => {
      const err = reconstructFromAxiosError(
        createAxiosError({
          status: 400,
          response: {
            data: createPylonError({
              code: "invalid_first_name_schema",
              message: "First name must be at least two characters",
              name: "InvalidFirstNameSchemaError",
              type: "urn:lindorm:tyr:error:invalid_first_name_schema",
            }),
            headers: {},
            status: 400,
            statusText: "Bad Request",
          },
        }),
      );

      expect(err).toBeInstanceOf(InvalidFirstNameSchemaError);
      expect(err.status).toEqual(400);
      expect(err.message).toEqual("First name must be at least two characters");
      expect(err.type).toEqual("urn:lindorm:tyr:error:invalid_first_name_schema");
    });

    test("should fall back to the status class when the caller has not registered the name", () => {
      const err = reconstructFromAxiosError(
        createAxiosError({
          status: 404,
          response: {
            data: createPylonError({ name: "SomeUnknownServiceError" }),
            headers: {},
            status: 404,
            statusText: "Not Found",
          },
        }),
      );

      expect(err).toBeInstanceOf(NotFoundError);
    });
  });

  describe("foreign upstream", () => {
    const createForeignError = (status: number, data: any, statusText = ""): any =>
      createAxiosError({
        message: `Request failed with status code ${status}`,
        code: status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
        status,
        response: { data, headers: { "x-trace": "abc" }, status, statusText },
      });

    test("should cast a 429 to TooManyRequestsError and type it by status", () => {
      const err = reconstructFromAxiosError(
        createForeignError(429, { code: "rate_limited", message: "Slow down" }),
      );

      expect(err).toBeInstanceOf(TooManyRequestsError);
      expect(err.status).toEqual(429);
      expect(err.type).toEqual("urn:http:error:429");
      expect(err.code).toEqual("rate_limited");
      expect(err.message).toEqual("Slow down");
      expect(err.title).toEqual("Too Many Requests");
    });

    test("should never claim a lindorm urn for an error a lindorm service did not raise", () => {
      const err = reconstructFromAxiosError(createForeignError(404, { oops: true }));

      expect(err.type).not.toContain("urn:lindorm");
      expect(err.type).toEqual("urn:http:error:404");
    });

    test("should not leak axios's transport code as the error code", () => {
      const err = reconstructFromAxiosError(createForeignError(404, { oops: true }));

      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBeNull();
      expect(err.message).toEqual("Request failed with status code 404");
    });

    test("should keep the foreign body out of caller-visible data", () => {
      const err = reconstructFromAxiosError(
        createForeignError(400, { secretish: "unknown shape" }),
      );

      expect(err.data).toEqual({});
      expect((err.debug as any).transport.response.data).toEqual({
        secretish: "unknown shape",
      });
    });

    test("should carry the foreign response headers in debug", () => {
      const err = reconstructFromAxiosError(createForeignError(404, {}));

      expect((err.debug as any).transport.response.headers).toEqual({ "x-trace": "abc" });
    });

    test("should read an oauth2 error body", () => {
      const err = reconstructFromAxiosError(
        createForeignError(401, {
          error: "invalid_grant",
          error_description: "Grant expired",
        }),
      );

      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toEqual("invalid_grant");
      expect(err.message).toEqual("Grant expired");
    });

    test("should read a text/plain body as the message", () => {
      const err = reconstructFromAxiosError(
        createForeignError(503, "Down for maintenance"),
      );

      expect(err.message).toEqual("Down for maintenance");
      expect(err.code).toBeNull();
    });

    test("should fall back to the family class for an unregistered status", () => {
      const client = reconstructFromAxiosError(createForeignError(425, {}));
      const server = reconstructFromAxiosError(createForeignError(509, {}));

      expect(client).toBeInstanceOf(ClientError);
      expect(client.type).toEqual("urn:http:error:425");
      expect(server).toBeInstanceOf(ServerError);
      expect(server.type).toEqual("urn:http:error:509");
    });
  });
});
