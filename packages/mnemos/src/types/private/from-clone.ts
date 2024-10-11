import { ILogger } from "@lindorm/logger";
import { IMnemosCache } from "../../interfaces";
import { MnemosSourceEntity } from "../mnemos-source";

export type FromClone = {
  _mode: "from_clone";
  client: IMnemosCache;
  entities: Array<MnemosSourceEntity>;
  logger: ILogger;
};
