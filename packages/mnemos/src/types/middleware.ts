import { IEntity } from "@lindorm/entity";
import {
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketData,
} from "@lindorm/pylon";
import { Dict } from "@lindorm/types";
import { IMnemosRepository, IMnemosSource } from "../interfaces";

// common context

type Context = {
  entities: Dict<IEntity>;
  repositories: {
    mnemos: Dict<IMnemosRepository<IEntity>>;
  };
  sources: {
    mnemos: IMnemosSource;
  };
};

// extended context

export type MnemosPylonHttpContext<Data = any, WebhookData = any> = PylonHttpContext<
  Data,
  WebhookData
> &
  Context;

export type MnemosPylonEventContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonEventContext<Args, Data> & Context;

// extended middleware

export type MnemosPylonHttpMiddleware<
  C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type MnemosPylonEventMiddleware<
  C extends MnemosPylonEventContext = MnemosPylonEventContext,
> = PylonEventMiddleware<C>;
