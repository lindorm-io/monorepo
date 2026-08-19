/**
 * `@AbstractSteps` targets — `abstract class` bases included, which
 * `Constructor`'s plain `new` signature refuses. A concrete class assigns
 * here too.
 */
export type AbstractConstructor<T = any> = abstract new (...args: any) => T;
