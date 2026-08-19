import { AbstractSteps } from "../../src/decorators/AbstractSteps.js";
import { BeforeFeature } from "../../src/decorators/BeforeFeature.js";
import { BeforeScenario } from "../../src/decorators/BeforeScenario.js";
import { Context } from "../../src/decorators/Context.js";
import { Inject } from "../../src/decorators/Inject.js";
import { Priority } from "../../src/decorators/Priority.js";
import { Binding, Given } from "../../src/index.js";

/**
 * Compiled by the REAL tsc (src/e2e/tsc-lowering.test.ts) — never by the
 * package's own vitest/swc pipeline — to pin the lowering `npm run build`
 * actually ships: own-array staging, own-only registration, tsc's
 * TC39-conformant metadata chain-linking for undecorated bases (which swc's
 * 2022-03 lowering does not do), and the marker guards firing identically
 * under `__esDecorate`.
 */

// UNDECORATED chain — the divergence pin's tsc half: tsc links these metadata
// levels, swc leaves a null prototype. No @Binding subclass at module scope,
// so the module loads clean; the guard probes below subclass them at CALL
// time.
export class UndecoratedGrand {
  @Given("a grand step")
  grandStep(): void {}
}

export class UndecoratedMid extends UndecoratedGrand {
  @Given("a mid step")
  midStep(): void {}
}

/** Marker-guard probe: an unmarked base DECLARING BEHAVIOUR, under tsc. */
export const defineBehaviourOffender = (): void => {
  @Binding()
  class Offending extends UndecoratedMid {}
  void Offending;
};

@Context()
export class FixtureContext {}

@Context()
export class OtherContext {}

/** Own-behaviour probe: a step staged on a @Context class, under tsc. */
export const defineContextBehaviourOffender = (): void => {
  @Context()
  class Offending {
    @Given("a context step")
    contextStep(): void {}
  }
  void Offending;
};

/** Marker-guard probe: an unmarked @Inject-only base, under tsc. */
export const defineInjectOnlyOffender = (): void => {
  class UnmarkedInjectBase {
    @Inject(FixtureContext)
    token!: FixtureContext;
  }

  @Binding()
  class Offending extends UnmarkedInjectBase {}
  void Offending;
};

@AbstractSteps()
export abstract class AbstractGrand {
  @Inject(FixtureContext)
  protected grandContext!: FixtureContext;

  @Inject(OtherContext)
  protected shadowed!: OtherContext;
}

@AbstractSteps()
export abstract class AbstractMid extends AbstractGrand {
  @Inject(OtherContext)
  protected midContext!: OtherContext;
}

@Binding()
export class LeafSteps extends AbstractMid {
  // An initializer, not `!`: a decorated shadow field cannot be `declare`d
  // and TS2612 refuses a bare redeclaration under useDefineForClassFields.
  @Inject(FixtureContext)
  protected shadowed: FixtureContext = undefined!;

  @Given("a leaf step")
  leafStep(): void {}

  // Static + instance hooks sharing ONE name — the compound-key case the
  // `${static}:${name}` priority key exists for.
  @BeforeFeature()
  @Priority(1)
  static setup(): void {}

  @BeforeScenario()
  @Priority(999)
  setup(): void {}
}
