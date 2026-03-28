import type { IIrisWorkerQueue, IMessage } from "../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../types";
import { DriverBase } from "./DriverBase";
import type { DriverBaseOptions } from "./DriverBase";

export type DriverWorkerQueueBaseOptions<M extends IMessage> = DriverBaseOptions<M>;

export abstract class DriverWorkerQueueBase<M extends IMessage>
  extends DriverBase<M>
  implements IIrisWorkerQueue<M>
{
  protected constructor(options: DriverWorkerQueueBaseOptions<M>) {
    super(options, "WorkerQueue");
  }

  public abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;

  public abstract consume(
    queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
    callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void>;

  public abstract unconsume(queue: string): Promise<void>;

  public abstract unconsumeAll(): Promise<void>;
}
