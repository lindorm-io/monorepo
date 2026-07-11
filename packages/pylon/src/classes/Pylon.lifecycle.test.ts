import { Amphora } from "@lindorm/amphora";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { Pylon } from "./Pylon.js";

// The sources pylon is handed (db/kv/bus) must be connected on setup and
// disconnected on teardown — symmetric, without the app touching them.
describe("Pylon source lifecycle", () => {
  let db: ReturnType<typeof createMockProteusSource>;
  let kv: ReturnType<typeof createMockProteusSource>;
  let bus: ReturnType<typeof createMockIrisSource>;
  let pylon: Pylon;

  beforeEach(() => {
    db = createMockProteusSource();
    kv = createMockProteusSource();
    bus = createMockIrisSource();

    const logger = createMockLogger();

    pylon = new Pylon({
      logger,
      amphora: new Amphora({ domain: "http://test.lindorm.io", logger }),
      domain: "http://test.lindorm.io",
      environment: "test",
      name: "@lindorm/pylon",
      port: 55599,
      version: "0.0.1",
      db: db as any,
      kv: kv as any,
      bus: bus as any,
      teardown: async () => {},
    });
  });

  test("should connect every source on setup, before setup() is called", async () => {
    await pylon.setup();

    for (const source of [db, kv, bus]) {
      expect(source.connect).toHaveBeenCalledTimes(1);
      expect(source.setup).toHaveBeenCalledTimes(1);
      expect(source.connect.mock.invocationCallOrder[0]).toBeLessThan(
        source.setup.mock.invocationCallOrder[0],
      );
    }
  });

  test("should disconnect every source on teardown", async () => {
    await pylon.setup();
    await pylon.teardown();

    expect(db.disconnect).toHaveBeenCalledTimes(1);
    expect(kv.disconnect).toHaveBeenCalledTimes(1);
    expect(bus.disconnect).toHaveBeenCalledTimes(1);
  });
});
