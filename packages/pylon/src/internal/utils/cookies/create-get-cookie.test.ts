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

  // Finding #12: the cache used to be keyed on `name` only and sat AHEAD of the
  // verify + decrypt checks — so a bare read cached a pre-verification /
  // pre-decryption value that a later stricter read served back unchecked.
  describe("finding #12 — verification cannot be laundered", () => {
    const signed = (value = "Y29va2llX3ZhbHVl") => ({
      name: "cookie_name",
      signature: "cookie_signature",
      kid: "cookie_kid",
      value,
    });

    test("auto-verifies a signed cookie on a BARE read, regardless of the option", async () => {
      const getCookie = createGetCookie({ ctx, config, parsed: [signed()] });

      await expect(getCookie("cookie_name")).resolves.toEqual("cookie_value");

      // No `signed` option, yet a present signature is still verified — an
      // unverified signature is never trusted.
      expect(verifyCookie).toHaveBeenCalledWith(
        ctx,
        "cookie_name",
        "Y29va2llX3ZhbHVl",
        "cookie_signature",
        "cookie_kid",
        undefined,
      );
    });

    test("a bare read of a signed cookie THROWS on a bad signature (was served raw before)", async () => {
      verifyCookie.mockRejectedValue(new ClientError("Cookie signature is invalid"));

      const getCookie = createGetCookie({ ctx, config, parsed: [signed()] });

      await expect(getCookie("cookie_name")).rejects.toThrow(ClientError);
    });

    test("bare read then signed:true read return one already-verified value", async () => {
      const getCookie = createGetCookie({ ctx, config, parsed: [signed()] });

      await expect(getCookie("cookie_name")).resolves.toEqual("cookie_value");
      await expect(getCookie("cookie_name", { signed: true })).resolves.toEqual(
        "cookie_value",
      );

      // Verified once, on the read that populated the slot; the second hits cache.
      expect(verifyCookie).toHaveBeenCalledTimes(1);
    });

    test("signed:true on an UNSIGNED cookie throws cookie_signature_required", async () => {
      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [
          { name: "cookie_name", signature: null, kid: null, value: "Y29va2llX3ZhbHVl" },
        ],
      });

      await expect(getCookie("cookie_name", { signed: true })).rejects.toMatchObject({
        code: "cookie_signature_required",
        status: ClientError.Status.Unauthorized,
      });
      expect(verifyCookie).not.toHaveBeenCalled();
    });

    test("the require-check runs per-call — a cached bare value cannot satisfy it", async () => {
      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [
          { name: "cookie_name", signature: null, kid: null, value: "Y29va2llX3ZhbHVl" },
        ],
      });

      await expect(getCookie("cookie_name")).resolves.toEqual("cookie_value");

      await expect(getCookie("cookie_name", { signed: true })).rejects.toMatchObject({
        code: "cookie_signature_required",
      });
    });
  });

  // Finding #12, value side: the read path used to be picked per cookie NAME, so
  // a bare read cached the undecrypted value and a later `{ encrypted: true }`
  // read skipped the seal-check + decrypt. Distinct value policies now key
  // distinct slots.
  describe("finding #12 — decryption cannot be laundered", () => {
    test("a bare read does not launder a later encrypted read (distinct cache slots)", async () => {
      const tokenised = `aes:${Buffer.from(JSON.stringify("secret_value")).toString("base64url")}`;

      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [{ name: "cookie_name", signature: null, kid: null, value: tokenised }],
      });

      // Bare read: plaintext policy, NOT decrypted, caches under enc=0.
      const plain = await getCookie("cookie_name");
      expect(plain).not.toEqual("secret_value");
      expect(ctx.aegis.aes.decrypt).not.toHaveBeenCalled();

      // Encrypted read: different slot ⇒ actually seal-checks + decrypts.
      await expect(getCookie("cookie_name", { encrypted: true })).resolves.toEqual(
        "secret_value",
      );
      expect(ctx.aegis.aes.decrypt).toHaveBeenCalledWith(tokenised);
    });

    test("an encrypted read of an UNSEALED value still throws cookie_not_encrypted", async () => {
      const forged = Buffer.from(JSON.stringify({ evil: true })).toString("base64url");

      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [{ name: "cookie_name", signature: null, kid: null, value: forged }],
      });

      await expect(getCookie("cookie_name", { encrypted: true })).rejects.toMatchObject({
        code: "cookie_not_encrypted",
      });
    });

    test("caches a falsy resolved value via `in`, not truthiness (no re-verify on hit)", async () => {
      // Decoded value parses to `0`; a truthiness cache check would MISS and
      // re-run verification. `cacheKey in cache` must hit.
      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [
          {
            name: "cookie_name",
            signature: "cookie_signature",
            kid: "cookie_kid",
            value: B64.encode("0", "b64u"),
          },
        ],
      });

      await expect(getCookie("cookie_name")).resolves.toBe(0);
      await expect(getCookie("cookie_name")).resolves.toBe(0);

      expect(verifyCookie).toHaveBeenCalledTimes(1);
    });
  });
});
