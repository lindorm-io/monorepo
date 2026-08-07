import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { JwtDriver } from "../drivers/auth/JwtDriver.js";
import type { PylonAuthSettings } from "../types/index.js";
import { Pylon } from "./Pylon.js";
import { PylonHttp } from "./PylonHttp.js";

// One deployment has ONE auth configuration. `PylonHttp` and `PylonIo` each used
// to parse their own, so a pylon serving both transports held two
// equal-but-distinct objects — the class of second-source-of-truth the app-config
// unification removed everywhere else.
describe("Pylon auth config", () => {
  const build = (auth?: PylonAuthSettings): Pylon => {
    const logger = createMockLogger();

    return new Pylon({
      logger,
      amphora: new Amphora({ internal: { issuer: "http://test.lindorm.io" }, logger }),
      environment: "test",
      name: "@lindorm/pylon",
      port: 0,
      version: "0.0.1",
      ...(auth ? { auth } : {}),
      socket: { enabled: true },
    });
  };

  test("should hand both transports the SAME parsed config, not two equal copies", () => {
    const pylon = build({ driver: new JwtDriver({ issuer: "self" }) });

    const http = (pylon as any).http.authConfig;
    const io = (pylon as any).io.authConfig;

    expect(http).toBeDefined();
    expect(io).toBe(http);
  });

  test("should leave both undefined when the deployment configured no auth", () => {
    const pylon = build();

    expect((pylon as any).http.authConfig).toBeUndefined();
    expect((pylon as any).io.authConfig).toBeUndefined();
  });

  // The fallback matters: a `PylonHttp` driven directly has no `Pylon` above it
  // to hand it a parsed config, and must still serve its auth router.
  test("should parse its own when a transport is driven standalone", () => {
    const logger = createMockLogger();

    const http = new PylonHttp({
      logger,
      amphora: new Amphora({ internal: { issuer: "http://test.lindorm.io" }, logger }),
      environment: "test",
      name: "@lindorm/pylon",
      version: "0.0.1",
      auth: { driver: new JwtDriver({ issuer: "self" }) },
    } as any);

    expect((http as any).authConfig).toMatchObject({
      defaultTokenExpiry: "1d",
      refresh: { maxAge: "1h", mode: "half_life" },
      router: null,
    });
  });
});
