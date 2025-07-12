import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpState,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import { IKafkaSource } from "../interfaces";

// common context

type Context = {
  sources: {
    kafka: IKafkaSource;
  };
};

// extended context

export type KafkaPylonHttpContext<Data = any> = PylonHttpContext<Data, PylonHttpState> &
  Context;

export type KafkaPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type KafkaPylonHttpMiddleware<
  C extends KafkaPylonHttpContext = KafkaPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type KafkaPylonSocketMiddleware<
  C extends KafkaPylonSocketContext = KafkaPylonSocketContext,
> = PylonSocketMiddleware<C>;
