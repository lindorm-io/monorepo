import { MessageBase } from "./MessageBase";
import { Data, IMessage, MessageOptions } from "../types";
import { MessageType } from "../enum";

export class DomainEvent<D extends Data = Data> extends MessageBase<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: IMessage) {
    super({ ...options, type: MessageType.DOMAIN_EVENT }, causation);
  }
}
