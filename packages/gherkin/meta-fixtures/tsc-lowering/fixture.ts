import { Binding, Given } from "../../src/index.js";

/**
 * Compiled by the REAL tsc (src/e2e/tsc-lowering.test.ts) — never by the
 * package's own vitest/swc pipeline — to pin the lowering `npm run build`
 * actually ships: own-array staging, own-only registration, and tsc's
 * TC39-conformant metadata chain-linking for undecorated bases (which swc's
 * 2022-03 lowering does not do).
 */
export class UndecoratedGrand {
  @Given("a grand step")
  grandStep(): void {}
}

export class UndecoratedMid extends UndecoratedGrand {
  @Given("a mid step")
  midStep(): void {}
}

@Binding()
export class LeafSteps extends UndecoratedMid {
  @Given("a leaf step")
  leafStep(): void {}
}
