import { IMessage, MessageOptions, Data } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class ReplayMessage<TData extends Data = Data>
  extends MessageBase<TData>
  implements IMessage
{
  public constructor(options: MessageOptions<TData>, causation?: IMessage) {
    super({ ...options, mandatory: true, type: MessageType.REPLAY_MESSAGE }, causation);
  }
}
