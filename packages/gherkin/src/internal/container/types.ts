import type { Constructor } from "@lindorm/types";
import type { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import type { StagedInject } from "../metadata/staged.js";
import type { ContextRegistration } from "../registry/registrations.js";

/** Who demanded a token — unknown-token errors name the authoring site. */
export type InjectDemand = {
  className: string;
  fieldName: string;
};

export type AssignInjectsOptions = {
  /** The demanding class's name — carried into resolution errors. */
  className: string;
  /** Nearest-wins deduplicated at registration (collect-injects.ts). */
  injects: Array<StagedInject>;
  instance: object;
};

export type ScenarioContainerOptions = {
  contexts: Array<ContextRegistration>;
  /** Pre-seeded — the runner constructs one per scenario (per Examples row). */
  scenarioInfo: ScenarioInfo;
};

export type ScenarioContainer = {
  /**
   * Assigns each `@Inject` field by name from `resolve(token)` — used for
   * `@Context` instances internally and for `@Binding` instances by the
   * runner. Never `Object.assign`.
   */
  assignInjects: (options: AssignInjectsOptions) => void;
  /**
   * Disposes every resolved context in REVERSE first-resolved order, awaiting
   * each optional `dispose()`. CONTINUES past a throwing dispose and collects
   * every error in the order encountered — each a `disposal_failed`
   * GherkinError anchored to its context class, carrying the original as
   * cause. It never throws itself; the caller decides reporting. A second
   * call disposes nothing and returns `[]`.
   */
  dispose: () => Promise<Array<Error>>;
  /**
   * The per-container singleton for a `@Context` token, or the pre-seeded
   * ScenarioInfo. Constructs lazily on first request; `@Inject` fields are
   * assigned EAGERLY immediately after construction, recursing in field
   * order — they are `undefined` inside the constructor. Throws after
   * `dispose()` — a late construction would never be disposed.
   */
  resolve: (token: Constructor) => object;
};
