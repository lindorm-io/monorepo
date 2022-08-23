import { Data, IMessage, MessageOptions } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class TimeoutMessage<TData extends Data = Data>
  extends MessageBase<TData>
  implements IMessage
{
  public constructor(options: MessageOptions<TData>, causation?: IMessage) {
    super({ ...options, mandatory: true, type: MessageType.TIMEOUT_MESSAGE }, causation);
  }
}
