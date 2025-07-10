import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { ViewIdentifier } from "../identifiers";

export interface ViewData<S extends Dict = Dict> extends ViewIdentifier {
  destroyed: boolean;
  meta: Dict;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface ViewModelOptions<S extends Dict = Dict> extends ViewIdentifier {
  destroyed?: boolean;
  logger: ILogger;
  meta?: Dict;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;
}
