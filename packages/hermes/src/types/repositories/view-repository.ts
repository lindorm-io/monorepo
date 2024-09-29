import { Dict } from "@lindorm/types";

export interface ViewRepositoryData<S extends Dict = Dict> {
  id: string;
  state: S;
  created_at: Date;
  updated_at: Date;
}
