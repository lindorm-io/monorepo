import type { Constructor } from "@lindorm/types";
import type { IMessage } from "./Message.js";

/**
 * Stream contract — UNIFORM across every driver (memory, rabbit, kafka, nats,
 * redis):
 *
 * - **Live transform, not a backfill.** A started pipeline transforms only
 *   messages published after `start()`; it never replays messages published
 *   earlier (`capabilities.streamReplay` is false everywhere — every driver joins
 *   an ephemeral consumer group at the live tail).
 * - **No durable offsets.** Stopping/restarting a pipeline discards its group and
 *   rejoins at the tail (`capabilities.streamDurableOffset` is false everywhere);
 *   messages published while it was down are not delivered on restart.
 * - **At-most-once across the batching window.** With `.batch(...)`, messages are
 *   acknowledged as they enter the buffer — if the process dies before the batch
 *   flushes, buffered-but-unflushed messages are lost. Non-batched stages are
 *   at-least-once (a throwing stage redelivers, then dead-letters on exhaustion).
 * - **memory is additionally lossy on pause** — nothing is retained while paused.
 *
 * Query `source.capabilities.stream / streamReplay / streamDurableOffset` rather
 * than assuming `stream: true` implies replay or durable resumption.
 */
export interface IIrisStreamPipeline {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isRunning(): boolean;
}

export interface IIrisStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> {
  from<T extends IMessage>(
    inputClass: Constructor<T>,
    options?: { topic?: string },
  ): IIrisStreamProcessor<T, Out>;
  filter(predicate: (message: In) => boolean): IIrisStreamProcessor<In, Out>;
  map<T extends IMessage>(transform: (message: In) => T): IIrisStreamProcessor<T, Out>;
  flatMap<T extends IMessage>(
    transform: (message: In) => Array<T>,
  ): IIrisStreamProcessor<T, Out>;
  batch(
    size: number,
    options?: { timeout?: number },
  ): IIrisStreamProcessor<Array<In>, Out>;
  to(outputClass: Constructor<Out>, options?: { topic?: string }): IIrisStreamPipeline;
}
