import { isUndefined } from "@lindorm/is";
import type { ScenarioInfoSettings } from "../types/scenario-info-settings.js";

/**
 * Scenario identity, injectable anywhere — `@Binding` and `@Context` classes
 * alike — via `@Inject(ScenarioInfo)`. A CLASS, not a type: `@Inject` takes a
 * runtime token. The runner constructs one per scenario (per Examples row)
 * and pre-seeds it into the container; it has no dependencies of its own, so
 * it is cycle-free by construction.
 */
export class ScenarioInfo {
  readonly featureName: string;
  readonly featureUri: string;
  readonly ruleName?: string;
  readonly scenarioName: string;
  readonly tags: Array<string>;
  readonly examplesRow?: Record<string, string>;
  readonly line: number;

  constructor(settings: ScenarioInfoSettings) {
    this.featureName = settings.featureName;
    this.featureUri = settings.featureUri;
    this.ruleName = settings.ruleName;
    this.scenarioName = settings.scenarioName;
    this.tags = settings.tags;
    // Object.fromEntries creates OWN data properties, so a "__proto__"
    // Examples column survives as a readable key — the reason the settings
    // carry entries rather than a Record (scenario-info-settings.ts). Pinned:
    // ScenarioInfo.test.ts.
    this.examplesRow = isUndefined(settings.examplesRow)
      ? undefined
      : Object.fromEntries(settings.examplesRow);
    this.line = settings.line;
  }
}
