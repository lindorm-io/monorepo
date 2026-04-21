import type { Constructor } from "@lindorm/types";
import type { IMessage } from "./Message.js";

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
