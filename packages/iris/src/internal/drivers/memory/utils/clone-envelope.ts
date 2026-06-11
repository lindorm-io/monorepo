import type { MemoryEnvelope } from "../types/memory-store.js";

/**
 * Produce an independent per-delivery copy of an envelope so that a consumer
 * mutating envelope-level fields (notably `headers`) cannot leak the mutation to
 * other fan-out subscribers or to its own retry. Real brokers re-parse every
 * delivery from the wire, giving each consumer an independent envelope; this
 * mirrors that isolation for the in-process memory driver. The payload Buffer is
 * shared by reference — it is read-only and the message body is re-deserialised
 * per delivery — while `headers` is shallow-copied (values are strings).
 */
export const cloneEnvelopeForDelivery = (envelope: MemoryEnvelope): MemoryEnvelope => ({
  ...envelope,
  headers: { ...envelope.headers },
});
