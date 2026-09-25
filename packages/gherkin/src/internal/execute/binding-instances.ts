import { isError, isObjectLike } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import type { ScenarioContainer } from "../container/types.js";
import type { StagedInject } from "../metadata/staged.js";
import { formatConstructorFailure } from "./format/format-constructor-failure.js";

/** What both a StepDefinition and a RegistryHook carry about their class. */
export type BindingClass = {
  className: string;
  injects: Array<StagedInject>;
  target: Constructor;
};

export type AcquirePosition = {
  /** Prebuilt position block — step anchor or scenario anchor. */
  anchor: string;
  remaining: number;
};

export type BindingInstances = {
  /**
   * The scenario's instance for a binding class — constructed on first
   * acquisition (lazily for step-matched classes, eagerly for hook-declaring
   * ones — run-scenario.ts), with `@Inject` fields assigned through the
   * container immediately after construction.
   */
  acquire: (binding: BindingClass, position: AcquirePosition) => object;
  /** The instance IF constructed — after-scenario hooks skip classes whose eager construction never happened. */
  get: (target: Constructor) => object | undefined;
};

/**
 * One instance per binding class per SCENARIO — never shared across
 * scenarios (the cache lives in the scenario body, beside the container).
 */
export const createBindingInstances = (
  container: ScenarioContainer,
): BindingInstances => {
  const instances = new Map<Constructor, object>();

  const acquire = (
    { className, injects, target }: BindingClass,
    { anchor, remaining }: AcquirePosition,
  ): object => {
    const existing = instances.get(target);

    // isObjectLike, not isObject: a binding instance's prototype is its class,
    // which isObject rejects — and a missed cache hit here would silently hand
    // every step a fresh instance. Pinned: run-scenario.test.ts ("should run
    // steps sequentially against ONE instance per class").
    if (isObjectLike(existing)) {
      return existing;
    }

    let instance: object;

    try {
      instance = new target() as object;
    } catch (error) {
      // A NEW error carries the anchor and the thrown value travels untouched
      // as `cause`: a frozen error cannot take a message, and the same
      // instance thrown twice would collect two anchors. Pinned:
      // binding-instances.test.ts ("a FROZEN binding-constructor error",
      // "the SAME thrown instance twice").
      throw new Error(
        formatConstructorFailure({
          anchor,
          className,
          message: isError(error) ? error.message : String(error),
          remaining,
        }),
        { cause: error },
      );
    }

    // Context constructor throws inside this call arrive already anchored to
    // their token (create-scenario-container.ts) and propagate untouched.
    container.assignInjects({ className, injects, instance });
    instances.set(target, instance);

    return instance;
  };

  return {
    acquire,
    get: (target: Constructor) => instances.get(target),
  };
};
