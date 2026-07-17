export type ConsumerNameType = "subscribe" | "worker" | "rpc";

export type ResolveConsumerNameOptions = {
  type: ConsumerNameType;
  topic?: string;
  queue?: string;
};

/**
 * The topic/queue portion of a consumer name, shared by every driver.
 * `subscribe` always names a specific queue on a topic; `worker`/`rpc` name
 * the queue, falling back to the topic. Each driver wraps this with its own
 * prefix, separator, label, sanitizer and suffix.
 */
export const resolveConsumerIdentifier = ({
  type,
  topic,
  queue,
}: ResolveConsumerNameOptions): string =>
  type === "subscribe" ? `${topic}.${queue}` : (queue ?? topic ?? "");

/**
 * The canonical logical consumer segment: `<topic>.<queue>` for subscribe,
 * `wq.<id>` for worker, `rpc.<id>` for rpc. Drivers that share the short
 * labels (kafka/redis/rabbit) build directly on this; nats composes its own
 * full-word label around {@link resolveConsumerIdentifier}.
 */
export const resolveConsumerName = (options: ResolveConsumerNameOptions): string => {
  switch (options.type) {
    case "subscribe":
      return resolveConsumerIdentifier(options);
    case "worker":
      return `wq.${resolveConsumerIdentifier(options)}`;
    case "rpc":
      return `rpc.${resolveConsumerIdentifier(options)}`;
  }
};
