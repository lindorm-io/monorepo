import { ReverseMap } from "../utility";

export const RdcSessionMethods = {
  DELETE: "delete",
  GET: "get",
  PATCH: "patch",
  POST: "post",
  PUT: "put",
} as const;

export type RdcSessionMethod = ReverseMap<typeof RdcSessionMethods>;
