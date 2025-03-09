import { Constructor, Dict } from "@lindorm/types";

export type EntityScannerInput<T extends Dict = Dict> = Array<Constructor<T> | string>;
