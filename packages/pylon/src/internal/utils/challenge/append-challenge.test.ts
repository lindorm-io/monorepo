import { beforeEach, describe, expect, test } from "vitest";
import type { PylonHttpContext } from "../../../types/index.js";
import { appendChallenge } from "./append-challenge.js";

describe("appendChallenge", () => {
  let headers: Record<string, string>;
  let ctx: PylonHttpContext;

  beforeEach(() => {
    headers = {};
    ctx = {
      response: { get: (field: string) => headers[field.toLowerCase()] ?? "" },
      set: (field: string, value: string) => {
        headers[field.toLowerCase()] = value;
      },
    } as unknown as PylonHttpContext;
  });

  test("should set a single challenge", () => {
    appendChallenge(ctx, "bearer", { realm: "lindorm.io", error: "invalid_token" });

    expect(headers).toMatchSnapshot();
  });

  test("should comma-join a second challenge instead of overwriting", () => {
    appendChallenge(ctx, "basic", { realm: "lindorm.io" });
    appendChallenge(ctx, "bearer", { realm: "lindorm.io", error: "invalid_token" });

    expect(headers).toMatchSnapshot();
  });

  test("should set the dpop nonce header and keep the nonce out of the auth-params", () => {
    appendChallenge(ctx, "dpop", {
      realm: "lindorm.io",
      error: "use_dpop_nonce",
      algs: ["ES256"],
      nonce: "nonce-value",
    });

    expect(headers["www-authenticate"]).not.toContain("nonce=");
    expect(headers).toMatchSnapshot();
  });

  test("should not set the dpop nonce header when no nonce is given", () => {
    appendChallenge(ctx, "dpop", { realm: "lindorm.io" });

    expect(headers["dpop-nonce"]).toBeUndefined();
    expect(headers).toMatchSnapshot();
  });
});
