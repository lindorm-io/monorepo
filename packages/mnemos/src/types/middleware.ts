import { IEntity } from "@lindorm/entity";
import {
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpState,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
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

export type MnemosPylonHttpContext<Data = any> = PylonHttpContext<Data, PylonHttpState> &
  Context;

export type MnemosPylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContext<Args, Data> & Context;

// extended middleware

export type MnemosPylonHttpMiddleware<
  C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
> = PylonHttpMiddleware<C>;

export type MnemosPylonSocketMiddleware<
  C extends MnemosPylonSocketContext = MnemosPylonSocketContext,
> = PylonSocketMiddleware<C>;
