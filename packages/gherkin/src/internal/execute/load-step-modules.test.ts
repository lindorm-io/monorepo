import { beforeEach, describe, expect, test } from "vitest";
import { Binding } from "../../decorators/Binding.js";
import { Given } from "../../decorators/Given.js";
import { drainRegistrations } from "../registry/registrations.js";
import { loadStepModules } from "./load-step-modules.js";

describe("loadStepModules", () => {
  beforeEach(() => {
    drainRegistrations();
  });

  test("should associate each registration with the module path whose thunk produced it", async () => {
    const modules = await loadStepModules({
      "src/aes.steps.ts": async () => {
        @Binding()
        class AesSteps {
          @Given("an oct key")
          anOctKey(): void {}
        }
        return AesSteps;
      },
      "src/keying.steps.ts": async () => {
        @Binding()
        class KeyingSteps {
          @Given("a keyring")
          aKeyring(): void {}
        }
        return KeyingSteps;
      },
    });

    expect(modules.map((module) => module.modulePath)).toEqual([
      "src/aes.steps.ts",
      "src/keying.steps.ts",
    ]);
    expect(
      modules[0].registrations.map((registration) => registration.className),
    ).toEqual(["AesSteps"]);
    expect(
      modules[1].registrations.map((registration) => registration.className),
    ).toEqual(["KeyingSteps"]);
  });

  test("should load module paths in ascending order regardless of key order", async () => {
    const loaded: Array<string> = [];

    const modules = await loadStepModules({
      "src/z.steps.ts": async () => loaded.push("z"),
      "src/a.steps.ts": async () => loaded.push("a"),
    });

    expect(loaded).toEqual(["a", "z"]);
    expect(modules.map((module) => module.modulePath)).toEqual([
      "src/a.steps.ts",
      "src/z.steps.ts",
    ]);
  });

  test("should carry an empty registration list for a module registering nothing", async () => {
    const modules = await loadStepModules({
      "src/helpers.steps.ts": async () => "no bindings here",
    });

    expect(modules).toEqual([{ modulePath: "src/helpers.steps.ts", registrations: [] }]);
  });

  test("should propagate a step-module import failure", async () => {
    await expect(
      loadStepModules({
        "src/broken.steps.ts": async () => {
          throw new Error("syntax error in step module");
        },
      }),
    ).rejects.toThrow("syntax error in step module");
  });
});
