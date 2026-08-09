import type { IMessage, SubscribeOptions } from "@lindorm/iris";
import type { Constructor } from "@lindorm/types";

/**
 * One bus subscription the deployment declares, bound at boot alongside Pylon's
 * own consumers.
 *
 * It is iris's own {@link SubscribeOptions} plus the `message` class, and not a
 * pylon-shaped copy of it: a second spelling of the subscribe surface is one
 * edit away from disagreeing with the one that does the work. So `topic` is the
 * broker topic bound verbatim, `queue` names a consumer group (omit it and every
 * instance receives every message), and `prefetch` is the in-flight ceiling —
 * all exactly as `IIrisMessageBus.subscribe` reads them.
 *
 * `message` is REQUIRED and has no default: a topic string names where to listen,
 * never how to read what arrives, and iris deserialises and validates the payload
 * against the `@Message` class. Pylon registers the class on `bus` before the
 * source sets up, so a deployment does not have to list it twice.
 */
export type PylonSubscribeSettings<M extends IMessage = IMessage> =
  SubscribeOptions<M> & {
    message: Constructor<M>;
  };
