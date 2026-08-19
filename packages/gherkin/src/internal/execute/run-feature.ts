import { buildRegistry } from "../registry/build-registry.js";
import { emitFeature } from "./emit-feature.js";
import { loadStepModules } from "./load-step-modules.js";
import { resolveSuiteApi } from "./suite-api.js";
import type { RunFeatureOptions } from "./types.js";

/**
 * The entry the generated feature module top-level awaits. Step modules load
 * and the registry builds for EVERY model kind — a broken step module or a
 * registry error (duplicate parameter type, unknown parameter type) fails
 * this file regardless of its own content, because the flat namespace makes
 * broken step definitions everyone's problem.
 */
export const runFeature = async (options: RunFeatureOptions): Promise<void> => {
  const api = resolveSuiteApi(options.api);
  const modules = await loadStepModules(options.stepModules);
  const registry = buildRegistry(modules);

  emitFeature({ api, model: options.model, registry });
};
