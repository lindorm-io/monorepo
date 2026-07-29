import type { IIrisPublisher, IMessage } from "../../interfaces/index.js";
import type { IrisDriverType, PublishOptions } from "../../types/index.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseSettings } from "./DriverBase.js";

export type DriverPublisherBaseSettings<M extends IMessage> = DriverBaseSettings<M> & {
  driverType: IrisDriverType;
};

export abstract class DriverPublisherBase<M extends IMessage>
  extends DriverBase<M>
  implements IIrisPublisher<M>
{
  protected constructor(options: DriverPublisherBaseSettings<M>) {
    super(options, "Publisher");
  }

  abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
}
