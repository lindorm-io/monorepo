/**
 * What ONE wire does with ONE option it is handed.
 *
 * Every wire-crossing input is typed as the KIT's own option type intersected
 * with the aegis-only fields, so the kit surface travels by rest-spread and no
 * destructure can drop it. What a spread cannot express is the residue: an
 * option this wire has no way to honour. Spread blindly it would be handed to a
 * kit that ignores it, which is the silent drop the spread exists to remove —
 * so the residue is DECLARED here and REFUSED above the seam instead.
 */
export type Disposition =
  /** Reaches the kit through the rest-spread. Proved by the disposition probe. */
  | { use: "forwarded" }
  /** The wire acts on it ITSELF and does not pass it down. `by` names how. */
  | { use: "consumed"; by: string }
  /**
   * This wire cannot honour it. A caller that supplies one is REFUSED above the
   * seam — never accepted and ignored, which leaves the caller believing a
   * request took effect. `reason` states the specification fact that makes it
   * unhonourable.
   */
  | { use: "unsupported"; reason: string };

/**
 * The per-option disposition table for one wire operation's KIT OPTION surface.
 *
 * `-?` strips optionality, so the table literal must supply EVERY key: adding an
 * option to a kit's option type fails to compile in every wire's table until it
 * has a row and someone has decided what that wire does with it. This is the
 * same mechanism `constants/verify-option-parity.ts` applies to the read side.
 */
export type InputDisposition<T> = { [K in keyof T]-?: Disposition };
