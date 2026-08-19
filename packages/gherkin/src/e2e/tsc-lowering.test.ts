import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Constructor } from "@lindorm/types";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Given } from "../decorators/Given.js";
import { readOwnSteps } from "../internal/metadata/stage-metadata.js";
import type { BindingRegistration } from "../internal/registry/registrations.js";

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

type FixtureModule = {
  LeafSteps: Constructor;
  UndecoratedGrand: Constructor;
  UndecoratedMid: Constructor;
};

type RegistrationsModule = {
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
    // The SAME module instance the compiled fixture's @Binding registered
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

  test("should register own steps only, even though tsc links the metadata chain", () => {
    const drained = registrations.drainRegistrations();

    expect(drained).toHaveLength(1);
    expect(drained[0].className).toBe("LeafSteps");
    expect(drained[0].steps.map((step) => step.expression)).toEqual(["a leaf step"]);
  });

  test("should chain-link an undecorated base's metadata under tsc — the TC39 semantics", () => {
    expect(Object.getPrototypeOf(ownMetadata(compiled.UndecoratedMid))).toBe(
      ownMetadata(compiled.UndecoratedGrand),
    );
    expect(Object.getPrototypeOf(ownMetadata(compiled.LeafSteps))).toBe(
      ownMetadata(compiled.UndecoratedMid),
    );
  });

  test("should NOT chain-link under swc — pins the divergence so an swc fix is caught deliberately", () => {
    // Control first: the swc twin stages normally, so a null prototype below
    // is a linking gap, not a broken probe.
    expect(expressionsOf(SwcMid)).toEqual(["an swc mid step"]);

    // The divergence @AbstractSteps and abstract_base_undecorated exist for:
    // if an swc upgrade makes this non-null, that guard's error branch goes
    // unreachable and the 100% branch gate fails — flip DELIBERATELY.
    expect(Object.getPrototypeOf(ownMetadata(SwcMid))).toBeNull();
    expect(Object.getPrototypeOf(ownMetadata(SwcMid))).not.toBe(ownMetadata(SwcGrand));
  });
});
