import { RabbitMessageBase } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { IHermesMessage } from "../interfaces";
import { AggregateIdentifier, HermesMessageOptions } from "../types";

export class HermesMessageBase<D extends Dict = Dict, M extends Dict = Dict>
  extends RabbitMessageBase
  implements IHermesMessage<D, M>
{
  public readonly aggregate: AggregateIdentifier;
  public readonly causationId: string;
  public readonly correlationId: string;
  public readonly data: D;
  public readonly meta: M;
  public readonly name: string;
  public readonly version: number;

  public constructor(options: HermesMessageOptions<D, M>, causation?: IHermesMessage) {
    super(options);

    this.aggregate = options.aggregate;
    this.causationId = options.causationId ?? causation?.id ?? this.id;
    this.correlationId =
      options.correlationId ?? causation?.correlationId ?? randomUUID();
    this.data = options.data ?? ({} as D);
    this.meta = options.meta ?? ({} as M);
    this.name = options.name;
    this.version = options.version ?? 1;
  }

  public get topic(): string {
    return `${this.aggregate.context}.${this.aggregate.name}.${this.name}`;
  }
}
