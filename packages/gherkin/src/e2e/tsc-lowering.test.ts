import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Constructor } from "@lindorm/types";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AbstractSteps } from "../decorators/AbstractSteps.js";
import { Given } from "../decorators/Given.js";
import { Inject } from "../decorators/Inject.js";
import type { GherkinError } from "../errors/GherkinError.js";
import { readOwnSteps } from "../internal/metadata/stage-metadata.js";
import type {
  BindingRegistration,
  ContextRegistration,
} from "../internal/registry/registrations.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_DIRECTORY = join(PACKAGE_ROOT, "meta-fixtures", "tsc-lowering");

// Symbol.metadata is the polyfilled Symbol.for slot (vitest.setup.ts), so the
// tsc-compiled copy and this in-process test read the SAME symbol — as do the
// lindormSymbol staging keys, which is what lets readOwnSteps (in-process)
// inspect metadata staged by the compiled copy.
const ownMetadata = (target: object): DecoratorMetadataObject => {
  const descriptor = Object.getOwnPropertyDescriptor(
    target,
    (Symbol as { metadata?: symbol }).metadata as symbol,
  );

  if (descriptor === undefined) {
    throw new Error(`${String(target)} carries no own Symbol.metadata`);
  }

  return descriptor.value as DecoratorMetadataObject;
};

const expressionsOf = (target: object): Array<string> =>
  readOwnSteps(ownMetadata(target)).map((step) => step.expression);

const captureGherkin = (fn: () => unknown): GherkinError => {
  try {
    fn();
  } catch (error) {
    // The compiled copy throws ITS module instance of GherkinError — a
    // different class identity than this process's import, so assertions read
    // properties rather than instanceof.
    return error as GherkinError;
  }
  throw new Error("expected function to throw");
};

// The swc twin of the fixture's undecorated chain, lowered IN-PROCESS by the
// package's own vitest/swc pipeline (decoratorVersion 2022-03) — the probe
// half of the divergence assertions below.
class SwcGrand {
  @Given("an swc grand step")
  grandStep(): void {}
}

class SwcMid extends SwcGrand {
  @Given("an swc mid step")
  midStep(): void {}
}

// The DECORATED swc twin: an @AbstractSteps base is the decorated-base case
// where BOTH lowerings link the chain — the fix the marker guard steers to.
class SwcToken {}

@AbstractSteps()
abstract class SwcAbstractBase {
  @Inject(SwcToken)
  protected base!: SwcToken;
}

@AbstractSteps()
abstract class SwcAbstractLeaf extends SwcAbstractBase {
  @Inject(SwcToken)
  protected leaf!: SwcToken;
}

type FixtureModule = {
  AbstractGrand: Constructor;
  AbstractMid: Constructor;
  FixtureContext: Constructor;
  LeafSteps: Constructor;
  OtherContext: Constructor;
  UndecoratedGrand: Constructor;
  UndecoratedMid: Constructor;
  defineBehaviourOffender: () => void;
  defineContextBehaviourOffender: () => void;
  defineInjectOnlyOffender: () => void;
};

type RegistrationsModule = {
  drainContextRegistrations: () => Array<ContextRegistration>;
  drainRegistrations: () => Array<BindingRegistration>;
};

/**
 * §2's carried item: vitest runs src through swc, but `npm run build` ships
 * tsc's `__esDecorate` lowering — so the lowering the package's tests
 * exercise is NOT the one consumers run. This suite compiles the fixture
 * with the REAL tsc (decorator-relevant flags mirroring tsconfig.build.json:
 * ES2022 target, NodeNext, verbatimModuleSyntax, NO experimentalDecorators)
 * into a temp dir UNDER the package — self-sufficient on bare `npm test`:
 * the fixture and its whole src import closure are compiled together, and
 * the emitted tree resolves its bare imports through the package's real
 * node_modules (a tmpdir outside the repo could not).
 */
describe("tsc lowering", () => {
  let outDirectory = "";
  let compiled: FixtureModule;
  let registrations: RegistrationsModule;

  beforeAll(async () => {
    outDirectory = await mkdtemp(join(FIXTURE_DIRECTORY, ".out-"));

    const program = ts.createProgram([join(FIXTURE_DIRECTORY, "fixture.ts")], {
      lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      outDir: outDirectory,
      rootDir: PACKAGE_ROOT,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: ["node"],
      verbatimModuleSyntax: true,
    });

    const emitted = program.emit();
    const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];

    expect(
      diagnostics.map((entry) =>
        ts.flattenDiagnosticMessageText(entry.messageText, "\n"),
      ),
    ).toEqual([]);

    compiled = await import(
      pathToFileURL(join(outDirectory, "meta-fixtures", "tsc-lowering", "fixture.js"))
        .href
    );
    // The SAME module instance the compiled fixture's decorators registered
    // into — native ESM caches by absolute URL.
    registrations = await import(
      pathToFileURL(join(outDirectory, "src", "internal", "registry", "registrations.js"))
        .href
    );
  }, 120_000);

  afterAll(async () => {
    await rm(outDirectory, { recursive: true, force: true });
  });

  test("should have compiled through tsc's __esDecorate lowering, not swc's", async () => {
    const source = await readFile(
      join(outDirectory, "meta-fixtures", "tsc-lowering", "fixture.js"),
      "utf8",
    );

    expect(source).toContain("__esDecorate");
  });

  test("should stage steps into own arrays — a subclass does not pollute its parent", () => {
    expect(expressionsOf(compiled.UndecoratedGrand)).toEqual(["a grand step"]);
    expect(expressionsOf(compiled.UndecoratedMid)).toEqual(["a mid step"]);
    expect(expressionsOf(compiled.LeafSteps)).toEqual(["a leaf step"]);
  });

  test("should register own steps and hooks with chain-collected injects under tsc", () => {
    const drained = registrations.drainRegistrations();

    expect(drained).toHaveLength(1);
    expect(drained[0].className).toBe("LeafSteps");
    expect(drained[0].steps.map((step) => step.expression)).toEqual(["a leaf step"]);
    // The compound `${static}:${name}` key under __esDecorate: one class, two
    // hooks named setup, two distinct priorities.
    expect(drained[0].hooks).toEqual([
      { kind: "BeforeFeature", methodName: "setup", priority: 1, static: true },
      { kind: "BeforeScenario", methodName: "setup", priority: 999, static: false },
    ]);
    // Leaf-first chain walk with nearest-wins shadowing: the leaf's shadowed
    // token overrides AbstractGrand's.
    expect(drained[0].injects).toEqual([
      { fieldName: "shadowed", token: compiled.FixtureContext },
      { fieldName: "midContext", token: compiled.OtherContext },
      { fieldName: "grandContext", token: compiled.FixtureContext },
    ]);
  });

  test("should register the fixture's @Context classes as tokens", () => {
    expect(registrations.drainContextRegistrations()).toEqual([
      { className: "FixtureContext", injects: [], target: compiled.FixtureContext },
      { className: "OtherContext", injects: [], target: compiled.OtherContext },
    ]);
  });

  test("should chain-link an undecorated base's metadata under tsc — the TC39 semantics", () => {
    expect(Object.getPrototypeOf(ownMetadata(compiled.UndecoratedMid))).toBe(
      ownMetadata(compiled.UndecoratedGrand),
    );
  });

  test("should chain-link an @AbstractSteps base under BOTH lowerings — the decorated-base case the guard steers to", () => {
    // tsc half: the fixture's decorated chain.
    expect(Object.getPrototypeOf(ownMetadata(compiled.LeafSteps))).toBe(
      ownMetadata(compiled.AbstractMid),
    );
    expect(Object.getPrototypeOf(ownMetadata(compiled.AbstractMid))).toBe(
      ownMetadata(compiled.AbstractGrand),
    );
    // swc half: the in-process twin.
    expect(Object.getPrototypeOf(ownMetadata(SwcAbstractLeaf))).toBe(
      ownMetadata(SwcAbstractBase),
    );
  });

  test("should NOT chain-link an undecorated base under swc — pins the divergence so an swc fix is caught deliberately", () => {
    // Control first: the swc twin stages normally, so a null prototype below
    // is a linking gap, not a broken probe.
    expect(expressionsOf(SwcMid)).toEqual(["an swc mid step"]);

    // The divergence @AbstractSteps and abstract_base_undecorated exist for:
    // if an swc upgrade makes this non-null, the undecorated-base repair the
    // guard demands stops being load-bearing — flip DELIBERATELY.
    expect(Object.getPrototypeOf(ownMetadata(SwcMid))).toBeNull();
    expect(Object.getPrototypeOf(ownMetadata(SwcMid))).not.toBe(ownMetadata(SwcGrand));
  });

  test("should fire the behaviour marker guard identically under __esDecorate", () => {
    const error = captureGherkin(() => compiled.defineBehaviourOffender());

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      ancestor: "UndecoratedMid",
      className: "Offending",
      memberKind: "step",
      memberName: "midStep",
    });
  });

  test("should fire the undecorated marker guard identically under __esDecorate", () => {
    const error = captureGherkin(() => compiled.defineInjectOnlyOffender());

    expect(error.code).toEqual("abstract_base_undecorated");
    expect(error.data).toEqual({
      ancestor: "UnmarkedInjectBase",
      className: "Offending",
    });
  });

  test("should fire the @Context own-behaviour guard identically under __esDecorate", () => {
    const error = captureGherkin(() => compiled.defineContextBehaviourOffender());

    expect(error.code).toEqual("context_declares_behaviour");
    expect(error.data).toEqual({
      className: "Offending",
      memberKind: "step",
      memberName: "contextStep",
    });
  });
});
