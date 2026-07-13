import { describe, expect, test } from "vitest";
import {
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_OPAQUE_TOKEN,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { redactData } from "./redact-data.js";

describe("redactData", () => {
  test("should strip signatures from token response fields", () => {
    const result = redactData({
      access_token: TEST_JWT,
      id_token: TEST_JWT,
      refresh_token: TEST_OPAQUE_TOKEN,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid profile",
    });

    expect(result).toMatchSnapshot();
    expect(JSON.stringify(result)).not.toContain(TEST_JWT_SIGNATURE);
  });

  test("should redact camel cased token fields", () => {
    expect(redactData({ accessToken: TEST_JWT, tokenType: "Bearer" })).toMatchSnapshot();
  });

  test("should filter secrets entirely", () => {
    const result = redactData({
      client_id: "client_01HZ",
      client_secret: TEST_PASSWORD,
      grant_type: "client_credentials",
    });

    expect(result).toMatchSnapshot();
    expect(JSON.stringify(result)).not.toContain(TEST_PASSWORD);
  });

  test("should filter camel cased secrets", () => {
    expect(
      redactData({ clientId: "client_01HZ", clientSecret: TEST_PASSWORD }),
    ).toMatchSnapshot();
  });

  test("should filter password and secret keys", () => {
    expect(
      redactData({ username: "user", password: TEST_PASSWORD, secret: "shh" }),
    ).toMatchSnapshot();
  });

  test("should redact a serialised json body", () => {
    const result = redactData(
      JSON.stringify({ client_id: "client_01HZ", client_secret: TEST_PASSWORD }),
    );

    expect(result).toMatchSnapshot();
    expect(result).not.toContain(TEST_PASSWORD);
  });

  test("should filter an unparseable body naming a sensitive key", () => {
    expect(
      redactData(`grant_type=client_credentials&client_secret=${TEST_PASSWORD}`),
    ).toMatchSnapshot();
  });

  test("should leave a plain string body untouched", () => {
    expect(redactData("Not Found")).toMatchSnapshot();
  });

  test("should not deep walk nested objects", () => {
    expect(
      redactData({ user: { password: TEST_PASSWORD }, items: [1, 2, 3] }),
    ).toMatchSnapshot();
  });

  test("should leave non-object data untouched", () => {
    expect(redactData(undefined)).toBeUndefined();
    expect(redactData(null)).toBeNull();
    expect(redactData(1234)).toEqual(1234);
  });

  test("should not mutate the source object", () => {
    const data = { access_token: TEST_JWT };

    redactData(data);

    expect(data.access_token).toEqual(TEST_JWT);
  });
});
