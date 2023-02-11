import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { EncryptedRecord, ProtectedRecord } from "../entity";
import { EncryptedRecordRepository, ProtectedRecordRepository } from "../infrastructure";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
} from "@lindorm-io/node-server";

type ServerAxios = LindormNodeServerAxios & {
  oauthClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  [key: string]: any; // TODO: FIX
};

type ServerEntity = {
  encryptedRecord: EncryptedRecord;
  protectedRecord: ProtectedRecord;
};

type ServerRepository = LindormNodeServerRepository & {
  encryptedRecordRepository: EncryptedRecordRepository;
  protectedRecordRepository: ProtectedRecordRepository;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
};

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
