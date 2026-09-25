import type { Constructor } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import { Context } from "../../decorators/Context.js";
import { GherkinError } from "../../errors/GherkinError.js";
import { Inject } from "../../decorators/Inject.js";
import type { StagedInject } from "../metadata/staged.js";
import type { ContextRegistration } from "../registry/registrations.js";
import { drainContextRegistrations } from "../registry/registrations.js";
import { createScenarioContainer } from "./create-scenario-container.js";
import type { ScenarioContainer } from "./types.js";

const scenarioInfo = (): ScenarioInfo =>
  new ScenarioInfo({
    featureName: "container feature",
    featureUri: "src/features/container.feature",
    scenarioName: "container scenario",
    tags: ["@container"],
    line: 3,
  });

const inject = (fieldName: string, token: Constructor): StagedInject => ({
  fieldName,
  token,
});

const registration = (
  target: Constructor,
  injects: Array<StagedInject> = [],
): ContextRegistration => ({ className: target.name, injects, target });

const container = (
  contexts: Array<ContextRegistration>,
  info: ScenarioInfo = scenarioInfo(),
): ScenarioContainer => createScenarioContainer({ contexts, scenarioInfo: info });

describe("createScenarioContainer", () => {
  describe("resolution", () => {
    test("should construct a context lazily and return the same instance per token", () => {
      const log: Array<string> = [];

      class AContext {
        public constructor() {
          log.push("construct A");
        }
      }

      const scoped = container([registration(AContext)]);

      expect(log).toEqual([]);

      const first = scoped.resolve(AContext);
      const second = scoped.resolve(AContext);

      expect(first).toBeInstanceOf(AContext);
      expect(second).toBe(first);
      expect(log).toEqual(["construct A"]);
    });

    test("should give two containers independent instances", () => {
      class AContext {}

      const contexts = [registration(AContext)];

      expect(container(contexts).resolve(AContext)).not.toBe(
        container(contexts).resolve(AContext),
      );
    });

    test("should construct every dependency BEFORE the dependent context, in field order", () => {
      const log: Array<string> = [];

      class BContext {
        public constructor() {
          log.push("construct B");
        }
      }

      class CContext {
        public constructor() {
          log.push("construct C");
        }
      }

      class AContext {
        public b!: BContext;
        public c!: CContext;

        public constructor() {
          log.push("construct A");
        }
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext), inject("c", CContext)]),
        registration(BContext),
        registration(CContext),
      ]);

      const resolved = scoped.resolve(AContext) as AContext;

      // Dependencies in declaration order, then the dependent — a constructor
      // that runs before its dependencies exist can allocate and then vanish.
      expect(log).toEqual(["construct B", "construct C", "construct A"]);
      expect(resolved.b).toBeInstanceOf(BContext);
      expect(resolved.c).toBeInstanceOf(CContext);
    });

    test("should NEVER run the dependent constructor when a dependency cannot resolve", () => {
      const constructed: Array<string> = [];

      class BContext {
        public constructor() {
          constructed.push("B");
        }
      }

      class CContext {
        public constructor() {
          constructed.push("C");
          throw new Error("C ctor boom");
        }
      }

      class AContext {
        public b!: BContext;
        public c!: CContext;

        public constructor() {
          constructed.push("A");
        }
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext), inject("c", CContext)]),
        registration(BContext),
        registration(CContext),
      ]);

      const error = capture(() => scoped.resolve(AContext));

      expect(error.message).toContain("Context class CContext constructor threw");
      expect(constructed).toEqual(["B", "C"]);
    });

    test("should leave injected fields undefined inside the constructor", () => {
      class BContext {}

      let observed: unknown = "unset";

      class AContext {
        public b!: BContext;

        public constructor() {
          observed = this.b;
        }
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext)]),
        registration(BContext),
      ]);

      const resolved = scoped.resolve(AContext) as AContext;

      expect(observed).toBeUndefined();
      expect(resolved.b).toBeInstanceOf(BContext);
    });

    test("should resolve a diamond dependency to one shared instance", () => {
      const log: Array<string> = [];

      class DContext {
        public constructor() {
          log.push("construct D");
        }
      }

      class BContext {
        public d!: DContext;
      }

      class CContext {
        public d!: DContext;
      }

      class AContext {
        public b!: BContext;
        public c!: CContext;
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext), inject("c", CContext)]),
        registration(BContext, [inject("d", DContext)]),
        registration(CContext, [inject("d", DContext)]),
        registration(DContext),
      ]);

      const resolved = scoped.resolve(AContext) as AContext;

      expect(log).toEqual(["construct D"]);
      expect(resolved.b.d).toBe(resolved.c.d);
    });

    test("should retry construction after a constructor throw instead of caching the failure", async () => {
      let attempts = 0;

      class BoomContext {
        public constructor() {
          attempts += 1;
          throw new Error("ctor failed");
        }
      }

      const scoped = container([registration(BoomContext)]);

      expect(() => scoped.resolve(BoomContext)).toThrow("ctor failed");
      expect(() => scoped.resolve(BoomContext)).toThrow("ctor failed");
      expect(attempts).toBe(2);

      // Never constructed to completion, so never recorded for disposal.
      await expect(scoped.dispose()).resolves.toEqual([]);
    });

    test("should anchor a throwing constructor to its TOKEN without mutating the thrown error", () => {
      const original = new Error("no endpoint configured");

      class AnchoredContext {
        public constructor() {
          throw original;
        }
      }

      const scoped = container([registration(AnchoredContext)]);
      const error = capture(() => scoped.resolve(AnchoredContext));

      expect(error).not.toBe(original);
      expect(error.message).toBe(
        "Context class AnchoredContext constructor threw\n\nno endpoint configured",
      );
      expect(error.cause).toBe(original);
      expect(original.message).toBe("no endpoint configured");
    });

    test("should anchor a FROZEN context-constructor error, retaining it as cause", () => {
      const original = Object.freeze(new Error("frozen context boom"));

      class FrozenContext {
        public constructor() {
          throw original;
        }
      }

      const scoped = container([registration(FrozenContext)]);
      const error = capture(() => scoped.resolve(FrozenContext));

      expect(error.message).toBe(
        "Context class FrozenContext constructor threw\n\nfrozen context boom",
      );
      expect(error.cause).toBe(original);
    });

    test("should anchor the SAME thrown instance twice independently, never compounding its message", () => {
      const original = new Error("shared boom");

      class SharedThrowContext {
        public constructor() {
          throw original;
        }
      }

      const scoped = container([registration(SharedThrowContext)]);

      const first = capture(() => scoped.resolve(SharedThrowContext));
      const second = capture(() => scoped.resolve(SharedThrowContext));

      expect(first).not.toBe(second);
      expect(first.message).toBe(
        "Context class SharedThrowContext constructor threw\n\nshared boom",
      );
      expect(second.message).toBe(first.message);
      expect(original.message).toBe("shared boom");
    });

    test("should anchor the INNER token when a recursive resolution's constructor throws", () => {
      class InnerContext {
        public constructor() {
          throw new Error("inner boom");
        }
      }

      class OuterContext {
        public inner!: InnerContext;
      }

      const scoped = container([
        registration(InnerContext),
        registration(OuterContext, [inject("inner", InnerContext)]),
      ]);

      const error = capture(() => scoped.resolve(OuterContext));

      // Only the frame that called `new` knows which token threw — an outer
      // wrap would blame OuterContext.
      expect(error.message).toBe(
        "Context class InnerContext constructor threw\n\ninner boom",
      );
    });

    test("should wrap a non-Error constructor throw into an Error with the original as cause", () => {
      class StringBoomContext {
        public constructor() {
          // eslint-disable-next-line no-throw-literal
          throw "ctor string";
        }
      }

      const scoped = container([registration(StringBoomContext)]);
      const error = capture(() => scoped.resolve(StringBoomContext));

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(
        "Context class StringBoomContext constructor threw\n\nctor string",
      );
      expect((error as unknown as { cause: unknown }).cause).toBe("ctor string");
    });

    test("should refuse to resolve after dispose — a late context would never be disposed", async () => {
      class LateContext {}

      const scoped = container([registration(LateContext)]);

      await scoped.dispose();

      const error = capture(() => scoped.resolve(LateContext));

      expect(errorShape(error)).toMatchSnapshot();
    });
  });

  describe("ScenarioInfo", () => {
    test("should resolve the pre-seeded instance without registration", () => {
      const info = scenarioInfo();
      const scoped = container([], info);

      expect(scoped.resolve(ScenarioInfo)).toBe(info);
    });

    test("should inject the pre-seeded instance into a context, cycle-free", () => {
      class BContext {
        public info!: ScenarioInfo;
      }

      class AContext {
        public b!: BContext;
        public info!: ScenarioInfo;
      }

      const info = scenarioInfo();
      const scoped = container(
        [
          registration(AContext, [inject("b", BContext), inject("info", ScenarioInfo)]),
          registration(BContext, [inject("info", ScenarioInfo)]),
        ],
        info,
      );

      const resolved = scoped.resolve(AContext) as AContext;

      // Pre-seeded means it is answered from the instance map before any
      // cycle bookkeeping — it can never appear in a resolution stack.
      expect(resolved.info).toBe(info);
      expect(resolved.b.info).toBe(info);
    });
  });

  describe("cycles", () => {
    test("should throw cyclic_context naming the full cycle path", () => {
      class AContext {
        public b!: object;
      }

      class BContext {
        public a!: object;
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext)]),
        registration(BContext, [inject("a", AContext)]),
      ]);

      const error = capture(() => scoped.resolve(AContext));

      expect(error.code).toBe("cyclic_context");
      expect(error.message).toBe(
        "Cyclic context injection: AContext -> BContext -> AContext",
      );
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should name a self-cycle as its own two-entry path", () => {
      class SelfContext {
        public self!: object;
      }

      const scoped = container([
        registration(SelfContext, [inject("self", SelfContext)]),
      ]);

      const error = capture(() => scoped.resolve(SelfContext));

      expect(error.message).toBe("Cyclic context injection: SelfContext -> SelfContext");
    });

    test("should exclude an acyclic head from the named path and unwind the stack", () => {
      class AContext {
        public b!: object;
      }

      class BContext {
        public a!: object;
      }

      class HeadContext {
        public a!: AContext;
      }

      class CleanContext {}

      const scoped = container([
        registration(HeadContext, [inject("a", AContext)]),
        registration(AContext, [inject("b", BContext)]),
        registration(BContext, [inject("a", AContext)]),
        registration(CleanContext),
      ]);

      const error = capture(() => scoped.resolve(HeadContext));

      // HeadContext demanded the cycle but is not part of the loop — naming
      // it would misdirect the fix.
      expect(error.message).toBe(
        "Cyclic context injection: AContext -> BContext -> AContext",
      );
      expect((error.data as { cycle: Array<string> }).cycle).toEqual([
        "AContext",
        "BContext",
        "AContext",
      ]);

      // The resolution stack unwound through the throw — the container stays
      // usable for unrelated tokens.
      expect(scoped.resolve(CleanContext)).toBeInstanceOf(CleanContext);
    });
  });

  describe("unknown tokens", () => {
    test("should name the token and the demanding field when resolved via assignInjects", () => {
      class UnregisteredContext {}

      class BindingHost {
        public missing!: UnregisteredContext;
      }

      const scoped = container([]);
      const instance = new BindingHost();

      const error = capture(() =>
        scoped.assignInjects({
          className: "BindingHost",
          injects: [inject("missing", UnregisteredContext)],
          instance,
        }),
      );

      expect(error.code).toBe("unknown_context_token");
      expect(error.message).toBe(
        "Unknown context token UnregisteredContext demanded by BindingHost.missing",
      );
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should name the token alone on a direct resolve", () => {
      class UnregisteredContext {}

      const error = capture(() => container([]).resolve(UnregisteredContext));

      expect(error.code).toBe("unknown_context_token");
      expect(error.message).toBe("Unknown context token UnregisteredContext");
      expect(error.data).toEqual({ token: "UnregisteredContext" });
    });

    test("should name the demanding context when a context's own inject is unregistered", () => {
      class UnregisteredContext {}

      class AContext {
        public missing!: UnregisteredContext;
      }

      const scoped = container([
        registration(AContext, [inject("missing", UnregisteredContext)]),
      ]);

      const error = capture(() => scoped.resolve(AContext));

      expect(error.message).toBe(
        "Unknown context token UnregisteredContext demanded by AContext.missing",
      );
    });
  });

  describe("assignInjects", () => {
    test("should assign a binding instance's fields from the same per-container singletons", () => {
      class AContext {}

      class BindingHost {
        public a!: AContext;
        public info!: ScenarioInfo;
      }

      const info = scenarioInfo();
      const scoped = container([registration(AContext)], info);
      const instance = new BindingHost();

      scoped.assignInjects({
        className: "BindingHost",
        injects: [inject("a", AContext), inject("info", ScenarioInfo)],
        instance,
      });

      expect(instance.a).toBeInstanceOf(AContext);
      expect(instance.a).toBe(scoped.resolve(AContext));
      expect(instance.info).toBe(info);
    });
  });

  describe("disposal", () => {
    test("should dispose every context that completed construction when a dependency throws", async () => {
      const disposals: Array<string> = [];

      class BContext {
        public dispose(): void {
          disposals.push("B");
        }
      }

      class CContext {
        public constructor() {
          throw new Error("C ctor boom");
        }
      }

      class AContext {
        public b!: BContext;
        public c!: CContext;

        public dispose(): void {
          disposals.push("A");
        }
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext), inject("c", CContext)]),
        registration(BContext),
        registration(CContext),
      ]);

      const error = capture(() => scoped.resolve(AContext));

      expect(error.message).toContain("Context class CContext constructor threw");
      expect(await scoped.dispose()).toEqual([]);
      // B constructed and MUST dispose. A was never constructed — its
      // dependency threw first — so there is no A to dispose.
      expect(disposals).toEqual(["B"]);
    });

    test("should dispose a shared diamond dependency exactly once", async () => {
      const disposals: Array<string> = [];

      class DContext {
        public dispose(): void {
          disposals.push("D");
        }
      }

      class BContext {
        public d!: DContext;
      }

      class CContext {
        public d!: DContext;
      }

      class AContext {
        public b!: BContext;
        public c!: CContext;
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext), inject("c", CContext)]),
        registration(BContext, [inject("d", DContext)]),
        registration(CContext, [inject("d", DContext)]),
        registration(DContext),
      ]);

      scoped.resolve(AContext);

      await expect(scoped.dispose()).resolves.toEqual([]);
      expect(disposals).toEqual(["D"]);
    });

    test("should dispose in reverse first-resolved order, dependencies last", async () => {
      const disposals: Array<string> = [];

      class BContext {
        public dispose(): void {
          disposals.push("B");
        }
      }

      class AContext {
        public b!: BContext;

        public dispose(): void {
          // A dependent's dispose may still use its injected dependency —
          // it runs BEFORE the dependency's.
          disposals.push(this.b instanceof BContext ? "A" : "A-without-b");
        }
      }

      class CContext {
        public dispose(): void {
          disposals.push("C");
        }
      }

      const scoped = container([
        registration(AContext, [inject("b", BContext)]),
        registration(BContext),
        registration(CContext),
      ]);

      scoped.resolve(AContext);
      scoped.resolve(CContext);

      // First-resolved order is [B, A, C]: B resolves before A is
      // constructed. Reversed: C, then A, then B.
      await expect(scoped.dispose()).resolves.toEqual([]);
      expect(disposals).toEqual(["C", "A", "B"]);
    });

    test("should await an async dispose before starting the next", async () => {
      const disposals: Array<string> = [];

      class SlowContext {
        public async dispose(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          disposals.push("slow");
        }
      }

      class FastContext {
        public dispose(): void {
          disposals.push("fast");
        }
      }

      const scoped = container([registration(SlowContext), registration(FastContext)]);

      // Resolved [fast, slow] so the reversed walk disposes SLOW FIRST — its
      // timer must complete before fast's synchronous dispose runs, which a
      // fire-and-forget loop would invert.
      scoped.resolve(FastContext);
      scoped.resolve(SlowContext);

      await scoped.dispose();

      expect(disposals).toEqual(["slow", "fast"]);
    });

    test("should skip contexts without a dispose method", async () => {
      class PlainContext {}

      const scoped = container([registration(PlainContext)]);

      scoped.resolve(PlainContext);

      await expect(scoped.dispose()).resolves.toEqual([]);
    });

    test("should continue past a throwing dispose and collect every error in order", async () => {
      const disposals: Array<string> = [];

      class AContext {
        public dispose(): void {
          disposals.push("A");
        }
      }

      class BContext {
        public dispose(): void {
          throw new Error("B failed");
        }
      }

      class CContext {
        public async dispose(): Promise<void> {
          throw new Error("C failed");
        }
      }

      const scoped = container([
        registration(AContext),
        registration(BContext),
        registration(CContext),
      ]);

      scoped.resolve(AContext);
      scoped.resolve(BContext);
      scoped.resolve(CContext);

      const errors = await scoped.dispose();

      // Reversed order is [C, B, A]: both throws are collected and A still
      // disposed — a leaked context is cross-scenario contamination. Each
      // error is a disposal_failed GherkinError anchored to its context class.
      expect(errors.map((error) => error.message)).toEqual([
        "Context class CContext dispose() threw\n\nC failed",
        "Context class BContext dispose() threw\n\nB failed",
      ]);
      expect(errors.map((error) => (error as GherkinError).code)).toEqual([
        "disposal_failed",
        "disposal_failed",
      ]);
      expect(errors.map((error) => (error.cause as Error).message)).toEqual([
        "C failed",
        "B failed",
      ]);
      expect(disposals).toEqual(["A"]);
    });

    test("should wrap a non-Error disposal rejection with the original as cause", async () => {
      class StringContext {
        public dispose(): Promise<void> {
          return Promise.reject("string failure");
        }
      }

      const scoped = container([registration(StringContext)]);

      scoped.resolve(StringContext);

      const [error] = await scoped.dispose();

      expect(error).toBeInstanceOf(GherkinError);
      expect((error as GherkinError).code).toBe("disposal_failed");
      expect(error.message).toBe(
        "Context class StringContext dispose() threw\n\nstring failure",
      );
      expect(error.cause).toBe("string failure");
    });

    test("should keep the disposal_failed code when dispose() throws an error carrying its own", async () => {
      class VaultContext {
        public dispose(): void {
          throw new GherkinError("vault sealed", { code: "vault_sealed" });
        }
      }

      const scoped = container([registration(VaultContext)]);

      scoped.resolve(VaultContext);

      const [error] = await scoped.dispose();

      expect((error as GherkinError).code).toBe("disposal_failed");
      // The original still travels as the cause.
      expect((error.cause as GherkinError).code).toBe("vault_sealed");
      expect(error.message).toContain("vault sealed");
    });

    test("should dispose nothing and return empty on a second call", async () => {
      const disposals: Array<string> = [];

      class AContext {
        public dispose(): void {
          disposals.push("A");
          throw new Error("A failed");
        }
      }

      const scoped = container([registration(AContext)]);

      scoped.resolve(AContext);

      const first = await scoped.dispose();
      const second = await scoped.dispose();

      // Idempotent: teardown is a once-per-scenario boundary — re-running it
      // would double-release external resources; the collected errors belong
      // to the first call alone.
      expect(first.map((error) => error.message)).toEqual([
        "Context class AContext dispose() threw\n\nA failed",
      ]);
      expect(second).toEqual([]);
      expect(disposals).toEqual(["A"]);
    });
  });

  describe("decorator round trip", () => {
    test("should resolve a @Context registration drained from the decorators", () => {
      drainContextRegistrations();

      @Context()
      class DecoratedDependency {}

      @Context()
      class DecoratedContext {
        @Inject(DecoratedDependency)
        public dependency!: DecoratedDependency;

        @Inject(ScenarioInfo)
        public info!: ScenarioInfo;
      }

      const contexts = drainContextRegistrations();
      const info = scenarioInfo();
      const scoped = createScenarioContainer({ contexts, scenarioInfo: info });

      const resolved = scoped.resolve(DecoratedContext) as DecoratedContext;

      expect(resolved.dependency).toBeInstanceOf(DecoratedDependency);
      expect(resolved.info).toBe(info);
    });
  });
});
