import { describe, expect, test } from "vitest";
import { loadConfig } from "./load-config.js";

describe("loadConfig", () => {
  test("loads YAML files and normalises keys to camelCase", () => {
    expect(loadConfig()).toEqual({
      env: "test",
      oneParent: {
        withNumber: 123,
        withString: "string",
        withNoReplacement: "one still here",
      },
      twoParent: {
        withObject: {
          withString: "string",
          withNoReplacement: "two still here",
        },
      },
      twoArray: ["one", "two", "three"],
      threeArray: ["one", "two", "three"],
      fourArray: [123, 456, 789],
      fiveArray: ["one", "two", "three"],
      sixNumberString: "987",
      seven: {
        boolean: false,
        nope: true,
      },
      withDotEnvReplacement: "one",
    });
  });
});
