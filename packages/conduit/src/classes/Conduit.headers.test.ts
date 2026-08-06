import nock from "nock";
import {
  conduitCorrelationMiddleware,
  conduitSessionMiddleware,
} from "../middleware/index.js";
import { Conduit } from "./Conduit.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// These assert the headers that actually leave the process, captured off the
// wire. Asserting `ctx.req.metadata` instead is what let a real bug hide: the
// correlation and session middleware write metadata only, the loggers read
// metadata, so logs looked correct while the upstream service received a
// freshly generated placeholder id that matched nothing.
describe("Conduit — forwarded headers reach the wire", () => {
  let observed: Record<string, any>;

  const capture = (): nock.Scope =>
    nock("http://test.lindorm.io")
      .get("/path")
      .times(1)
      .reply(200, function () {
        observed = this.req.headers;
        return {};
      });

  beforeEach(() => {
    observed = {};
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("should forward the correlation id set by middleware", async () => {
    const scope = capture();

    const conduit = new Conduit({
      baseUrl: "http://test.lindorm.io",
      middleware: [conduitCorrelationMiddleware("cor_forwarded")],
    });

    await conduit.get("/path");

    expect(observed["x-correlation-id"]).toBe("cor_forwarded");
    expect(scope.isDone()).toBe(true);
  });

  test("should forward the session id set by middleware", async () => {
    const scope = capture();

    const conduit = new Conduit({
      baseUrl: "http://test.lindorm.io",
      middleware: [conduitSessionMiddleware("ses_forwarded")],
    });

    await conduit.get("/path");

    expect(observed["x-session-id"]).toBe("ses_forwarded");
    expect(scope.isDone()).toBe(true);
  });

  test("should forward both together", async () => {
    const scope = capture();

    const conduit = new Conduit({
      baseUrl: "http://test.lindorm.io",
      middleware: [
        conduitCorrelationMiddleware("cor_both"),
        conduitSessionMiddleware("ses_both"),
      ],
    });

    await conduit.get("/path");

    expect(observed["x-correlation-id"]).toBe("cor_both");
    expect(observed["x-session-id"]).toBe("ses_both");
    expect(scope.isDone()).toBe(true);
  });

  test("should send a generated correlation id and no session header by default", async () => {
    const scope = capture();

    const conduit = new Conduit({ baseUrl: "http://test.lindorm.io" });

    await conduit.get("/path");

    expect(observed["x-correlation-id"]).toEqual(expect.stringContaining("cor_"));
    expect(observed["x-request-id"]).toEqual(expect.stringContaining("req_"));
    expect(observed).not.toHaveProperty("x-session-id");
    expect(scope.isDone()).toBe(true);
  });
});
