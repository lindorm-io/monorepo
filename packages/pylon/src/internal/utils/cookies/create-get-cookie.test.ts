import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import type { PylonCookieConfig } from "../../../types/index.js";
import { createGetCookie } from "./create-get-cookie.js";
import { verifyCookie as _verifyCookie } from "./verify-cookie.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("./verify-cookie.js");

const verifyCookie = _verifyCookie as Mock;

describe("createGetCookie", async () => {
  let ctx: any;
  let config: PylonCookieConfig;

  beforeEach(() => {
    ctx = { aegis: createMockAegis(), amphora: createMockAmphora() };
    config = { encoding: "base64url" };
    verifyCookie.mockResolvedValue(undefined);
  });

  afterEach(vi.clearAllMocks);

  test("should return null for missing cookie", async () => {
    const getCookie = createGetCookie({ ctx, config, parsed: [] });

    await expect(getCookie("missing")).resolves.toBeNull();
  });

  test("should decode plain value with config encoding", async () => {
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [
        { name: "cookie_name", signature: null, kid: null, value: "Y29va2llX3ZhbHVl" },
      ],
    });

    await expect(getCookie("cookie_name")).resolves.toEqual("cookie_value");
  });

  test("should decode value with override encoding", async () => {
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [
        { name: "cookie_name", signature: null, kid: null, value: "bmV3X3ZhbHVl" },
      ],
    });

    await expect(getCookie("cookie_name", { encoding: "base64" })).resolves.toEqual(
      "new_value",
    );
  });

  test("should parse json data", async () => {
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [
        {
          name: "cookie_name",
          signature: null,
          kid: null,
          value: B64.encode('{"key":"value"}', "b64u"),
        },
      ],
    });

    await expect(getCookie("cookie_name")).resolves.toEqual({ key: "value" });
  });

  test("should decrypt aes-tokenised value when encrypted is declared", async () => {
    const tokenised = `aes:${Buffer.from(JSON.stringify("secret_value")).toString("base64url")}`;

    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, kid: null, value: tokenised }],
    });

    await expect(getCookie("cookie_name", { encrypted: true })).resolves.toEqual(
      "secret_value",
    );
    expect(ctx.aegis.aes.decrypt).toHaveBeenCalledWith(tokenised);
  });

  // Policy is the authority, not the byte prefix: a value that merely LOOKS
  // tokenised is parsed as plaintext when the read did not declare `encrypted`.
  test("should NOT decrypt a tokenised-looking value when encrypted is not declared", async () => {
    const tokenised = `aes:${Buffer.from(JSON.stringify("secret_value")).toString("base64url")}`;

    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, kid: null, value: tokenised }],
    });

    const result = await getCookie("cookie_name");

    expect(ctx.aegis.aes.decrypt).not.toHaveBeenCalled();
    expect(result).not.toEqual("secret_value");
  });

  // The exploit: a forged UNSEALED value under an encrypted policy must throw,
  // never be handed back as trusted plaintext.
  test("should throw when encrypted is declared but the value is not sealed", async () => {
    const forged = Buffer.from(JSON.stringify({ evil: true })).toString("base64url");

    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, kid: null, value: forged }],
    });

    await expect(getCookie("cookie_name", { encrypted: true })).rejects.toThrow(
      ClientError,
    );
    expect(ctx.aegis.aes.decrypt).not.toHaveBeenCalled();
  });

  test("should verify signed cookie", async () => {
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [
        {
          name: "cookie_name",
          signature: "cookie_signature",
          kid: "cookie_kid",
          value: "Y29va2llX3ZhbHVl",
        },
      ],
    });

    await expect(getCookie("cookie_name", { signed: true })).resolves.toEqual(
      "cookie_value",
    );
    expect(verifyCookie).toHaveBeenCalledWith(
      ctx,
      "cookie_name",
      "Y29va2llX3ZhbHVl",
      "cookie_signature",
      "cookie_kid",
      undefined,
    );
  });

  test("should cache resolved values", async () => {
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [
        { name: "cookie_name", signature: null, kid: null, value: "Y29va2llX3ZhbHVl" },
      ],
    });

    await getCookie("cookie_name");
    await getCookie("cookie_name");

    expect(verifyCookie).not.toHaveBeenCalled();
  });
});
