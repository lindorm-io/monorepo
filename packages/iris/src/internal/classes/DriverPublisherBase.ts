import type { IIrisPublisher, IMessage } from "../../interfaces/index.js";
import type { PublishOptions } from "../../types/index.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseOptions } from "./DriverBase.js";

export type DriverPublisherBaseOptions<M extends IMessage> = DriverBaseOptions<M>;

export abstract class DriverPublisherBase<M extends IMessage>
  extends DriverBase<M>
  implements IIrisPublisher<M>
{
  protected constructor(options: DriverPublisherBaseOptions<M>) {
    super(options, "Publisher");
  }

  public abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
}
