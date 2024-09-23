import { dotCase } from "@lindorm/case";
import { randomUUID } from "crypto";
import { IRabbitMessage } from "../interfaces";

export class RabbitMessageBase implements IRabbitMessage {
  public readonly id: string;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly timestamp: Date;
  public readonly type: string;

  public constructor(options: Partial<IRabbitMessage> = {}) {
    this.id = options.id ?? randomUUID();
    this.delay = options.delay ?? 0;
    this.mandatory = options.mandatory ?? false;
    this.timestamp = options.timestamp ?? new Date();
    this.type = options.type ?? this.constructor.name;
  }

  public get topic(): string {
    return dotCase(this.type);
  }
}
