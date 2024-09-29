import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { ViewIdentifier } from "../identifiers";

export interface ViewData<S extends Dict = Dict> extends ViewIdentifier {
  destroyed: boolean;
  hash: string;
  meta: Dict;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface ViewOptions<S extends Dict = Dict> extends ViewIdentifier {
  destroyed?: boolean;
  hash?: string;
  logger: ILogger;
  meta?: Dict;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;
}
