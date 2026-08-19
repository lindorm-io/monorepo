import { describe, expect, test } from "vitest";
import * as plugin from "./plugin.js";

describe("plugin", () => {
  test("should export the public surface", () => {
    expect(Object.keys(plugin).sort()).toMatchSnapshot();
  });

  test("should export the plugin factory as a value", () => {
    expect(plugin.gherkinPlugin).toBeTypeOf("function");
  });
});
