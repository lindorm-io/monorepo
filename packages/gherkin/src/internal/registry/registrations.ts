import type { Constructor } from "@lindorm/types";
import type { StagedParameterType, StagedStep } from "../metadata/staged.js";

export type BindingRegistration = {
  className: string;
  parameterTypes: Array<StagedParameterType>;
  steps: Array<StagedStep>;
  target: Constructor;
};

// Module-global by design: registration is a decoration-time side effect and
// module state is per-worker (vitest isolate:true makes it per-feature-file).
const pending: Array<BindingRegistration> = [];

export const addRegistration = (registration: BindingRegistration): void => {
  pending.push(registration);
};

/**
 * Returns the registrations added since the previous drain, in decoration
 * order, and clears the list. The runtime imports one step module at a time
 * and drains after each import, which is what associates a registration with
 * its `import.meta.glob` module path.
 */
export const drainRegistrations = (): Array<BindingRegistration> =>
  pending.splice(0, pending.length);
