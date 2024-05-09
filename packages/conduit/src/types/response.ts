import { Dict, Header } from "@lindorm/types";

export type ConduitResponse<D = any> = {
  data: D;
  status: number;
  statusText: string;
  headers: Dict<Header>;
};
