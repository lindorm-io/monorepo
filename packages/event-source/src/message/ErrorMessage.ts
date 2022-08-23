import { Data, IMessage, MessageOptions } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class ErrorMessage<TData extends Data = Data>
  extends MessageBase<TData>
  implements IMessage
{
  public constructor(options: MessageOptions<TData>, causation?: IMessage) {
    super({ ...options, type: MessageType.ERROR_MESSAGE }, causation);
  }
}
