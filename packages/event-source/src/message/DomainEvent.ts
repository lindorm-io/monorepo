import { MessageBase } from "./MessageBase";
import { Data, IMessage, MessageOptions } from "../types";
import { MessageType } from "../enum";

export class DomainEvent<TData extends Data = Data> extends MessageBase<TData> implements IMessage {
  public constructor(options: MessageOptions<TData>, causation?: IMessage) {
    super({ ...options, type: MessageType.DOMAIN_EVENT }, causation);
  }
}
