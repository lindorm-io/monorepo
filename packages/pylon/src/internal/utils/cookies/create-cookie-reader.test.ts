import { createMockAegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { PylonCookieConfig } from "../../../types";
import { createCookieReader } from "./create-cookie-reader";
import { verifyCookie as _verifyCookie } from "./verify-cookie";

jest.mock("./verify-cookie");

const verifyCookie = _verifyCookie as jest.Mock;

describe("createCookieReader", () => {
  let ctx: any;
  let config: PylonCookieConfig;

  beforeEach(() => {
    ctx = { aegis: createMockAegis(), amphora: createMockAmphora() };
    config = { encoding: "base64url" };
    verifyCookie.mockResolvedValue(undefined);
  });

  afterEach(jest.clearAllMocks);

  test("should return null for missing cookie", async () => {
    const reader = createCookieReader({ ctx, config, parsed: [] });

    await expect(reader.get("missing")).resolves.toBeNull();
  });

  test("should decode plain value with config encoding", async () => {
    const reader = createCookieReader({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, value: "Y29va2llX3ZhbHVl" }],
    });

    await expect(reader.get("cookie_name")).resolves.toEqual("cookie_value");
  });

  test("should decode value with override encoding", async () => {
    const reader = createCookieReader({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, value: "bmV3X3ZhbHVl" }],
    });

    await expect(reader.get("cookie_name", { encoding: "base64" })).resolves.toEqual(
      "new_value",
    );
  });

  test("should parse json data", async () => {
    const reader = createCookieReader({
      ctx,
      config,
      parsed: [
        {
          name: "cookie_name",
          signature: null,
          value: B64.encode('{"key":"value"}', "b64u"),
        },
      ],
    });

    await expect(reader.get("cookie_name")).resolves.toEqual({ key: "value" });
  });

  test("should decrypt aes-tokenised value", async () => {
    const tokenised = `aes:${Buffer.from(JSON.stringify("secret_value")).toString("base64url")}`;

    const reader = createCookieReader({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, value: tokenised }],
    });

    await expect(reader.get("cookie_name")).resolves.toEqual("secret_value");
    expect(ctx.aegis.aes.decrypt).toHaveBeenCalledWith(tokenised);
  });

  test("should verify signed cookie", async () => {
    const reader = createCookieReader({
      ctx,
      config,
      parsed: [
        {
          name: "cookie_name",
          signature: "cookie_signature",
          value: "Y29va2llX3ZhbHVl",
        },
      ],
    });

    await expect(reader.get("cookie_name", { signed: true })).resolves.toEqual(
      "cookie_value",
    );
    expect(verifyCookie).toHaveBeenCalledWith(
      ctx,
      "cookie_name",
      "Y29va2llX3ZhbHVl",
      "cookie_signature",
    );
  });

  test("should cache resolved values", async () => {
    const reader = createCookieReader({
      ctx,
      config,
      parsed: [{ name: "cookie_name", signature: null, value: "Y29va2llX3ZhbHVl" }],
    });

    await reader.get("cookie_name");
    await reader.get("cookie_name");

    expect(verifyCookie).not.toHaveBeenCalled();
  });
});
