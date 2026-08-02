import { describe, expect, test } from "vitest";
import * as openid from "../index.js";
import * as schemas from "./index.js";

describe("schemas/index", () => {
  test("should export every schema", () => {
    expect(Object.keys(schemas).sort()).toMatchSnapshot();
  });

  test("should carry one schema per vocabulary set", () => {
    expect(Object.keys(schemas).every((key) => key.endsWith("Schema"))).toBe(true);
  });

  /**
   * The `.` entry must keep zero runtime imports — `aegis`, `amphora`,
   * `conduit` and `pylon` all depend on this package for its browser-safe
   * vocabulary. zod is opt-in behind the `@lindorm/openid/schemas` subpath, so
   * a schema leaking into the root barrel would pull zod into every consumer.
   */
  test("should keep the schemas out of the root barrel", () => {
    expect(Object.keys(openid).filter((key) => key.endsWith("Schema"))).toEqual([]);
  });
});
