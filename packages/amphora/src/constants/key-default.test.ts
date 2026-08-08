import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { Amphora } from "../classes/Amphora.js";
import { applyKeyFloor } from "../utils/merge-conditions.js";
import { ENVELOPE_DEFAULT } from "./key-default.js";
import { ENVELOPE_FLOOR } from "./key-floor.js";

const ISSUER = "https://test.lindorm.io/";

/**
 * The three-layer contract, on a REAL vault: the floor is not overridable, the
 * default IS, and the default's whole job is reaching past the publish gate.
 */
describe("ENVELOPE_DEFAULT", () => {
  let amphora: Amphora;

  const encKey = (publish: boolean, purpose: string): IKryptos =>
    KryptosKit.generate.auto({ algorithm: "dir", issuer: ISSUER, publish, purpose });

  beforeEach(() => {
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger: createMockLogger() });
  });

  test("selects an internal unpublished key for a caller that names no publish", async () => {
    const internal = encKey(false, "cookie");
    amphora.add(internal);

    const query = applyKeyFloor(ENVELOPE_FLOOR, ENVELOPE_DEFAULT, { purpose: "cookie" });

    await expect(amphora.find(query)).resolves.toMatchObject({ id: internal.id });
  });

  // Without the default layer the same selector falls through to the publish
  // gate, which hides precisely the key an envelope operation wants.
  test("is what makes that key reachable — the gate hides it otherwise", async () => {
    amphora.add(encKey(false, "cookie"));

    await expect(
      amphora.find(applyKeyFloor(ENVELOPE_FLOOR, { purpose: "cookie" })),
    ).rejects.toThrow();
  });

  test("yields to a caller that states publish: true", async () => {
    const published = encKey(true, "cookie");
    amphora.add([published, encKey(false, "cookie")]);

    const query = applyKeyFloor(ENVELOPE_FLOOR, ENVELOPE_DEFAULT, {
      purpose: "cookie",
      publish: true,
    });

    expect(query.publish).toBe(true);
    await expect(amphora.find(query)).resolves.toMatchObject({ id: published.id });
  });

  // A default is not a floor: it sits among the caller layers, so it must never
  // survive where the caller disagrees, and must never displace the floor.
  test("is overridable while the floor above it is not", () => {
    expect(
      applyKeyFloor(ENVELOPE_FLOOR, ENVELOPE_DEFAULT, {
        publish: true,
        use: "sig",
      }),
    ).toEqual({ ...ENVELOPE_FLOOR, publish: true });
  });
});
