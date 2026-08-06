import nock from "nock";
import { conduitChangeRequestBodyMiddleware } from "../middleware/index.js";
import { Conduit } from "./Conduit.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

/**
 * These assert the encoding that actually leaves the process, captured off the
 * wire. A JSON body reaching an RFC 6749 §4.1.3 token endpoint is accepted by
 * some providers (Auth0) and rejected by others (Discord), so the assertion has
 * to be on the Content-Type and the serialised payload — not on the options.
 */
describe("Conduit — request content type on the wire", () => {
  let observed: { contentType?: string; body?: unknown };

  const capture = (): nock.Scope =>
    nock("http://test.lindorm.io")
      .post("/path")
      .times(1)
      .reply(200, function (_uri, requestBody) {
        observed = {
          contentType: this.req.headers["content-type"],
          body: requestBody,
        };
        return {};
      });

  beforeEach(() => {
    observed = {};
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("should send JSON by default", async () => {
    const scope = capture();

    const conduit = new Conduit({ baseUrl: "http://test.lindorm.io" });

    await conduit.post("/path", { body: { grantType: "refresh_token" } });

    expect(observed.contentType).toMatch(/^application\/json/);
    expect(observed.body).toEqual({ grantType: "refresh_token" });
    expect(scope.isDone()).toBe(true);
  });

  test("should send urlencoded when contentType asks for it", async () => {
    const scope = capture();

    const conduit = new Conduit({ baseUrl: "http://test.lindorm.io" });

    await conduit.post("/path", {
      body: { grant_type: "refresh_token", refresh_token: "rt" },
      contentType: "application/x-www-form-urlencoded",
    });

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(observed.body as string))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "rt",
    });
    expect(scope.isDone()).toBe(true);
  });

  // The option is read at compose time, AFTER every middleware — so a body
  // rewritten by middleware is what gets urlencoded. Doing this as a middleware
  // instead would make the result depend on registration order.
  test("should urlencode the body a middleware rewrote", async () => {
    const scope = capture();

    const conduit = new Conduit({
      baseUrl: "http://test.lindorm.io",
      middleware: [conduitChangeRequestBodyMiddleware("snake")],
    });

    await conduit.post("/path", {
      body: { grantType: "authorization_code", codeVerifier: "verifier" },
      contentType: "application/x-www-form-urlencoded",
    });

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(observed.body as string))).toEqual({
      grant_type: "authorization_code",
      code_verifier: "verifier",
    });
    expect(scope.isDone()).toBe(true);
  });

  test("should repeat a list parameter rather than joining it", async () => {
    const scope = capture();

    const conduit = new Conduit({ baseUrl: "http://test.lindorm.io" });

    await conduit.post("/path", {
      body: { audience: ["https://one.lindorm.io", "https://two.lindorm.io"] },
      contentType: "application/x-www-form-urlencoded",
    });

    expect(new URLSearchParams(observed.body as string).getAll("audience")).toEqual([
      "https://one.lindorm.io",
      "https://two.lindorm.io",
    ]);
    expect(scope.isDone()).toBe(true);
  });
});
