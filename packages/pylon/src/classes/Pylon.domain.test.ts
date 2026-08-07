import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { Pylon } from "./Pylon.js";

// `domain` is this service's own identifier — the `WWW-Authenticate` realm and
// the RFC 9728 `resource` value. It defaults to the issuer the service mints
// under, which is amphora's `internal` scope and nothing else: a bare
// `amphora.issuer` naming no scope is not part of that surface.
describe("Pylon domain", () => {
  const build = (issuer?: string, domain?: string): Pylon => {
    const logger = createMockLogger();

    return new Pylon({
      logger,
      amphora: new Amphora({ ...(issuer ? { internal: { issuer } } : {}), logger }),
      environment: "test",
      name: "@lindorm/pylon",
      port: 0,
      version: "0.0.1",
      ...(domain ? { domain } : {}),
    });
  };

  test("should default to the amphora internal issuer", () => {
    const pylon = build("http://test.lindorm.io");

    expect((pylon as any).options.domain).toBe("http://test.lindorm.io");
  });

  test("should prefer an explicitly configured domain", () => {
    const pylon = build("http://test.lindorm.io", "http://api.lindorm.io");

    expect((pylon as any).options.domain).toBe("http://api.lindorm.io");
  });

  // A verify-only deployment mints nothing, so it has no issuer to be named by.
  test("should fall back to unknown when the amphora declares no issuer", () => {
    const pylon = build();

    expect((pylon as any).options.domain).toBe("unknown");
  });
});
