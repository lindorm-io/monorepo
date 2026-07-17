/**
 * Append the broadcast suffix to a resolved destination when the envelope is a
 * broadcast, so each consumer's unique group/consumer receives it independently
 * instead of competing for it on the shared destination.
 *
 * Shared by BOTH the publish path and every driver's delay-replay callback — a
 * delayed broadcast must route to the same broadcast destination a non-delayed
 * one does. The separator differs per driver (Kafka/NATS use ".", Redis ":").
 */
export const resolveBroadcastDestination = (
  base: string,
  broadcast: boolean,
  separator: string,
): string => (broadcast ? `${base}${separator}broadcast` : base);
