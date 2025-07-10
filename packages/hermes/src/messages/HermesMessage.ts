import {
  CorrelationField,
  DelayField,
  Field,
  MandatoryField,
  MessageBase,
  Topic,
} from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import z from "zod";
import { IHermesMessage } from "../interfaces";
import { AggregateIdentifier } from "../types";

@Topic(
  (message) => `${message.aggregate.context}.${message.aggregate.name}.${message.name}`,
)
export class HermesMessage<D = Dict, M extends Dict = Dict>
  extends MessageBase
  implements IHermesMessage<D>
{
  @Field("string")
  public readonly name!: string;

  @Field("integer", { fallback: () => 1 })
  public readonly version!: number;

  @Field("object", {
    schema: z.object({
      id: z.string().uuid(),
      name: z.string(),
      context: z.string(),
    }),
  })
  public readonly aggregate!: AggregateIdentifier;

  @DelayField()
  public readonly delay!: number;

  @MandatoryField()
  public readonly mandatory!: boolean;

  @Field("uuid", { fallback: () => randomUUID() })
  public readonly causationId!: string;

  @CorrelationField()
  public readonly correlationId!: string;

  @Field("object", { fallback: () => ({}) })
  public readonly data!: D;

  @Field("object", { fallback: () => ({}) })
  public readonly meta!: M;
}
