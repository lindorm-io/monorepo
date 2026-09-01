import { TEST_OCT_KEY_JWK } from "../__fixtures__/oct-keys.js";
import { KryptosKit } from "./KryptosKit.js";
import { describe, expect, test } from "vitest";

describe("KryptosKit ownership", () => {
  test("provenance round-trips through the DB shape", () => {
    const foreign = KryptosKit.from.jwk(TEST_OCT_KEY_JWK);
    const ours = KryptosKit.from.jwk(TEST_OCT_KEY_JWK, true);

    expect(KryptosKit.from.db(foreign.toDB()).internal).toBe(false);
    expect(KryptosKit.from.db(ours.toDB()).internal).toBe(true);
  });
});
