import type { IIrisWorkerQueue, IMessage } from "../../interfaces/index.js";
import type {
  ConsumeEnvelope,
  ConsumeOptions,
  PublishOptions,
} from "../../types/index.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseOptions } from "./DriverBase.js";

export type DriverWorkerQueueBaseOptions<M extends IMessage> = DriverBaseOptions<M>;

export abstract class DriverWorkerQueueBase<M extends IMessage>
  extends DriverBase<M>
  implements IIrisWorkerQueue<M>
{
  protected constructor(options: DriverWorkerQueueBaseOptions<M>) {
    super(options, "WorkerQueue");
  }

  abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;

  abstract consume(
    queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
    callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void>;

  abstract unconsume(queue: string): Promise<void>;

  abstract unconsumeAll(): Promise<void>;
}
