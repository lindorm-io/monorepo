import type { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import type { AmphoraSettings } from "../../types/index.js";
import { createExternalConduit } from "./create-external-conduit.js";

/**
 * Reading the Conduit's own config is white-box, and deliberately so: the HANDOFF
 * is the whole of amphora's contract here. An end-to-end assertion would be
 * stronger but cannot pass today — `Conduit` overwrites its instance-level
 * `timeout` with the per-request one on every request, so the value never
 * reaches axios. That is a conduit defect, not an amphora one; when it is fixed,
 * this handoff is what makes `AmphoraSettings.timeout` take effect.
 */
const conduitConfig = (conduit: Conduit): { maxRedirects: number; timeout: number } =>
  (conduit as unknown as { config: { maxRedirects: number; timeout: number } }).config;

describe("createExternalConduit", () => {
  const logger = createMockLogger();

  const create = (settings: Partial<AmphoraSettings> = {}): Conduit =>
    createExternalConduit({ logger, ...settings } as AmphoraSettings, logger);

  test("should default the fetch timeout to 10 seconds", () => {
    expect(conduitConfig(create()).timeout).toBe(10000);
  });

  test("should forward a configured timeout", () => {
    expect(conduitConfig(create({ timeout: 2000 })).timeout).toBe(2000);
  });

  test("should keep following no redirects by default", () => {
    expect(conduitConfig(create()).maxRedirects).toBe(0);
  });
});
