import { ClassLike, Dict } from "@lindorm/types";
import {
  AggregateIdentifier,
  CloneHermesOptions,
  EventEmitterListener,
  HermesAdmin,
  HermesCommandOptions,
  HermesStatus,
} from "../types";

export interface IHermes {
  admin: HermesAdmin;
  status: HermesStatus;

  on<D extends Dict = Dict>(eventName: string, listener: EventEmitterListener<D>): void;
  clone(options?: CloneHermesOptions): IHermes;
  command<C extends ClassLike = ClassLike, M extends Dict = Dict>(
    command: C,
    options: HermesCommandOptions<M>,
  ): Promise<AggregateIdentifier>;
  query<R>(query: ClassLike): Promise<R>;
  setup(): Promise<void>;
}
