/**
 * What ONE wire does with ONE option it is handed. The kit surface travels by
 * rest-spread, so no destructure can drop it; what a spread cannot express is the
 * residue — an option this wire has no way to honour — which is DECLARED here and
 * REFUSED above the seam rather than handed to a kit that ignores it.
 */
export type Disposition =
  /** Reaches the kit through the rest-spread. Proved by the disposition probe. */
  | { use: "forwarded" }
  /** The wire acts on it ITSELF and does not pass it down. `by` names how. */
  | { use: "consumed"; by: string }
  /**
   * This wire cannot honour it. A caller that supplies one is REFUSED above the
   * seam rather than accepted and ignored. `reason` is caller-visible and states
   * what makes it unhonourable.
   */
  | { use: "unsupported"; reason: string };

/**
 * The per-option disposition table for one wire operation's KIT OPTION surface.
 * `-?` strips optionality, so adding an option to a kit's option type fails to
 * compile in every wire's table until it has a row — the same mechanism
 * `constants/verify-option-parity.ts` applies to the read side.
 */
export type InputDisposition<T> = { [K in keyof T]-?: Disposition };
