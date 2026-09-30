import { isUndefined } from "@lindorm/is";
import type { Wire } from "./raw-bucket.js";

/**
 * The opening a scenario name carries to state its wire. Total over {@link Wire},
 * so a third wire is a compile error here rather than a prefix nothing reads.
 */
const PREFIX = { jose: "jose: ", cose: "cose: " } as const satisfies Record<Wire, string>;

const WIRES = Object.keys(PREFIX) as ReadonlyArray<Wire>;

/** The wire a scenario's name states, or `undefined` for a name that states none. */
export const scenarioWireOf = (scenarioName: string): Wire | undefined =>
  WIRES.find((wire) => scenarioName.startsWith(PREFIX[wire]));

/**
 * A scenario states its wire twice — the opening of its name and the `{wire}`
 * argument of each step it runs — and nothing in the runtime compares them. A step
 * trusting the argument alone acts on whichever wire its sentence names, so a
 * scenario could carry one wire in its name and exercise the other.
 */
export const assertNameStatesWire = (scenarioName: string, wire: Wire): void => {
  const stated = scenarioWireOf(scenarioName);

  if (stated === wire) return;

  const openings = WIRES.map((tag) => `"${PREFIX[tag]}"`).join(" or ");

  throw new Error(
    isUndefined(stated)
      ? `the step acts on the ${wire} wire, and the scenario states no wire: a scenario running a {wire} step opens with ${openings} — "${scenarioName}"`
      : `the step acts on the ${wire} wire, but the scenario states the ${stated} wire — "${scenarioName}"`,
  );
};
