import { isArrayBuffer } from "./is-array-buffer.js";

/**
 * A DETACHED `ArrayBuffer` — one whose memory has been transferred away. It
 * holds no readable byte: every view constructed over it throws, and the views
 * that already exist either report zero or throw on access. Nothing about it is
 * comparable except the detachment itself.
 *
 * Gated on the value REALLY being an `ArrayBuffer`, the same shape as
 * {@link isError}: `instanceof` for this realm, the `[object ArrayBuffer]` tag
 * for one from a `vm` context or a worker — the tag comes from the internal
 * slot, so it survives both the realm boundary and the detachment. Without the
 * gate, ordinary data carrying a `detached` field would answer `true`.
 *
 * `false` for a `SharedArrayBuffer` — shared memory cannot be detached, so that
 * is the ANSWER and not a refusal to answer.
 *
 * Deliberately NOT a type predicate. There is no type for a detached buffer, so
 * the only narrowing on offer would be `input is ArrayBuffer` — which is wrong
 * on the `false` branch, where every live `ArrayBuffer` lands.
 *
 * `ArrayBuffer.prototype.detached` is ES2024; a runtime without it reads
 * `undefined`, so the answer degrades to `false` rather than throwing.
 */
export const isDetached = (input?: any): boolean =>
  (isArrayBuffer(input) ||
    Object.prototype.toString.call(input) === "[object ArrayBuffer]") &&
  input.detached === true;
