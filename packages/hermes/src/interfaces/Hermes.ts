import { ClassLike, Dict } from "@lindorm/types";
import { HermesStatus } from "../enums";
import {
  AggregateIdentifier,
  EventEmitterListener,
  HermesAdmin,
  HermesCommandOptions,
} from "../types";

export interface IHermes<
  C extends ClassLike = ClassLike,
  Q extends ClassLike = ClassLike,
> {
  admin: HermesAdmin;
  status: HermesStatus;

  on<D extends Dict = Dict>(eventName: string, listener: EventEmitterListener<D>): void;
  command<M extends Dict = Dict>(
    command: C,
    options: HermesCommandOptions<M>,
  ): Promise<AggregateIdentifier>;
  query<R>(query: Q): Promise<R>;
  setup(): Promise<void>;
}
