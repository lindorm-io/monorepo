import { dotCase } from "@lindorm/case";
import { randomUUID } from "crypto";
import { IAmqpMessage } from "../interfaces";

export class AmqpMessageBase implements IAmqpMessage {
  private readonly _topic: string;

  public readonly id: string;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly timestamp: Date;
  public readonly type: string;

  public constructor(options: Partial<IAmqpMessage> = {}) {
    this.id = options.id ?? randomUUID();
    this.delay = options.delay ?? 0;
    this.mandatory = options.mandatory ?? false;
    this.timestamp = options.timestamp ?? new Date();
    this.type = options.type ?? this.constructor.name;

    this._topic = options.topic ?? dotCase(this.constructor.name);
  }

  public get topic(): string {
    return this._topic;
  }
}
