/**
 * A COSE map key. RFC 9052 §1.5 defines `label = int / tstr`, so a header
 * parameter — and a CWT claim — is keyed by an integer OR by a text string, and
 * the integer `4` and the text `"4"` are DIFFERENT labels.
 *
 * The COSE header maps were typed `Map<number, unknown>` while every label aegis
 * wrote was an integer. That stopped being true when the interoperable default
 * started spelling a private-use parameter by its string label
 * (`internal/registry/is-private-use-label.ts`), so the maps say what the wire
 * says.
 */
export type CoseLabel = number | string;
