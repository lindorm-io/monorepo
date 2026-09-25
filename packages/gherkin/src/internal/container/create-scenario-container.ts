import { isError, isFunction, isObjectLike, isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import { GherkinError } from "../../errors/GherkinError.js";
import { formatContextConstructorFailure } from "../execute/format/format-context-constructor-failure.js";
import { formatDisposalFailure } from "../execute/format/format-disposal-failure.js";
import type { StagedInject } from "../metadata/staged.js";
import type { ContextRegistration } from "../registry/registrations.js";
import type {
  AssignInjectsOptions,
  InjectDemand,
  ScenarioContainer,
  ScenarioContainerOptions,
} from "./types.js";

/** A dependency already resolved, awaiting its field on a constructed instance. */
type ResolvedField = {
  fieldName: string;
  value: object;
};

/**
 * One container per SCENARIO — and per Examples row — created by the runner;
 * two containers never share a context instance. Context constructors are
 * synchronous by design (an async constructor would make resolution order
 * between contexts observable); a throwing constructor is anchored to its
 * TOKEN at the construction site — resolution is recursive, so only the
 * frame that called `new` knows which token threw.
 */
export const createScenarioContainer = (
  options: ScenarioContainerOptions,
): ScenarioContainer => {
  const registrations = new Map<Constructor, ContextRegistration>(
    options.contexts.map((registration) => [registration.target, registration]),
  );

  // Pre-seeded, so resolve() answers ScenarioInfo from the instance map
  // before any cycle bookkeeping — it can never appear in a resolution stack,
  // and it never enters the disposal record.
  const instances = new Map<Constructor, object>([[ScenarioInfo, options.scenarioInfo]]);

  /**
   * FIRST-RESOLVED order: an instance is recorded once constructed and
   * assigned, and its dependencies resolve before it is constructed, so they
   * are recorded BEFORE it — the reversed disposal walk then disposes a
   * dependent before the contexts it injects, and a dispose() may still use
   * its injected fields. Pinned: create-scenario-container.test.ts ("reverse
   * first-resolved order").
   */
  const resolved: Array<object> = [];

  const resolving: Array<ContextRegistration> = [];

  let disposed = false;

  const resolveFields = (
    injects: Array<StagedInject>,
    className: string,
  ): Array<ResolvedField> =>
    injects.map((inject) => ({
      fieldName: inject.fieldName,
      value: resolveToken(inject.token, { className, fieldName: inject.fieldName }),
    }));

  const assignFields = (instance: object, fields: Array<ResolvedField>): void => {
    // Each field by name — never Object.assign, which would attach unknown
    // keys silently and clobber with undefined.
    for (const field of fields) {
      (instance as Record<string, unknown>)[field.fieldName] = field.value;
    }
  };

  const resolveToken = (token: Constructor, demand?: InjectDemand): object => {
    // A resolve after dispose would construct a context whose dispose() never
    // runs — the cross-scenario leak the per-scenario lifetime exists to
    // prevent — so it fails loudly instead. The runner disposes as its very
    // last act (run-scenario.ts), so only a runner bug can reach this.
    if (disposed) {
      throw new GherkinError(`Cannot resolve ${token.name} after dispose()`, {
        code: "container_disposed",
        details:
          "The scenario container was already disposed; resolving would construct a context whose dispose() never runs. Nothing may touch the container after the scenario's teardown.",
        data: { token: token.name },
      });
    }

    const existing = instances.get(token);

    // isObjectLike, not isObject: a context instance's prototype is its
    // class, which isObject rejects — a missed hit would construct a second
    // instance and split the scenario's shared state.
    if (isObjectLike(existing)) {
      return existing;
    }

    const registration = registrations.get(token);

    if (isUndefined(registration)) {
      const demanded = isUndefined(demand)
        ? ""
        : ` demanded by ${demand.className}.${demand.fieldName}`;

      throw new GherkinError(`Unknown context token ${token.name}${demanded}`, {
        code: "unknown_context_token",
        details:
          "The token is neither a registered @Context class nor ScenarioInfo — the usual authoring mistake is a missing @Context() decorator on the token class. Add @Context() to it, or inject a registered context.",
        data: {
          token: token.name,
          ...(isUndefined(demand)
            ? {}
            : { className: demand.className, fieldName: demand.fieldName }),
        },
      });
    }

    const start = resolving.findIndex((entry) => entry.target === token);

    if (start !== -1) {
      // The FULL cycle path, from the token's own frame — an unrelated head
      // of the stack is not part of the loop and would misdirect the fix.
      const cycle = [
        ...resolving.slice(start).map((entry) => entry.className),
        registration.className,
      ];

      throw new GherkinError(`Cyclic context injection: ${cycle.join(" -> ")}`, {
        code: "cyclic_context",
        details:
          "Resolving the token re-entered its own resolution — the @Context classes inject each other in a loop, which no construction order can satisfy. Break the loop by removing one of the @Inject fields, or move the shared state into a third context both inject.",
        data: { cycle },
      });
    }

    resolving.push(registration);

    try {
      // Dependencies FIRST: a constructor that ran before they existed could
      // acquire a resource and then be discarded by their failure, leaving
      // nothing recorded for disposal. Pinned:
      // create-scenario-container.test.ts ("NEVER run the dependent
      // constructor when a dependency cannot resolve").
      const fields = resolveFields(registration.injects, registration.className);

      let instance: object;

      try {
        // Injected fields are undefined during the constructor — assignment is
        // eager but strictly post-construction. Pinned:
        // create-scenario-container.test.ts ("undefined inside the constructor").
        instance = new registration.target() as object;
      } catch (error) {
        // A NEW error carries the anchor and the thrown value travels
        // untouched as `cause`: a frozen error cannot take a message, and the
        // same instance thrown twice would collect two anchors. Pinned:
        // create-scenario-container.test.ts ("without mutating the thrown
        // error", "the SAME thrown instance twice").
        throw new Error(
          formatContextConstructorFailure({
            className: registration.className,
            message: isError(error) ? error.message : String(error),
          }),
          { cause: error },
        );
      }

      assignFields(instance, fields);
      instances.set(token, instance);
      resolved.push(instance);

      return instance;
    } finally {
      resolving.pop();
    }
  };

  const dispose = async (): Promise<Array<Error>> => {
    if (disposed) {
      return [];
    }

    disposed = true;

    const errors: Array<Error> = [];

    for (const instance of [...resolved].reverse()) {
      const candidate = (instance as { dispose?: unknown }).dispose;

      if (isFunction(candidate)) {
        try {
          // Awaited SEQUENTIALLY: teardown unwinds setup, so a context must
          // be fully disposed before the one it depends on starts.
          await candidate.call(instance);
        } catch (error) {
          // Anchored HERE — only this frame knows which context's dispose()
          // threw. Wrapped as `disposal_failed` (§4 taxonomy): a teardown
          // error is the runner's own failure, never an assertion diff, so it
          // gets the house code instead of the primary-instance rethrow steps
          // and hooks use. The original travels as the cause.
          const className = instance.constructor.name;
          const failure = new GherkinError(
            formatDisposalFailure({
              className,
              message: isError(error) ? error.message : String(error),
            }),
            {
              code: "disposal_failed",
              details:
                "A context's dispose() threw or rejected during the scenario's teardown. Disposal continues through the remaining contexts; the failure is reported against the scenario, appended after any earlier failure.",
              data: { className },
              cause: error,
            },
          );

          errors.push(failure);
        }
      }
    }

    return errors;
  };

  return {
    assignInjects: ({ className, injects, instance }: AssignInjectsOptions): void =>
      assignFields(instance, resolveFields(injects, className)),
    dispose,
    resolve: (token: Constructor): object => resolveToken(token),
  };
};
