/**
 * A COSE map key — an integer OR a text string, with the integer `4` and the text
 * `"4"` DIFFERENT labels. RFC 9052 §1.5.
 *
 * ⚠ Not `number`: the interoperable default spells a private-use parameter by its
 * string label (`internal/registry/is-private-use-label.ts`), so a number-keyed
 * map cannot say what the wire says.
 */
export type CoseLabel = number | string;
