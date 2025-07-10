import { Constructor, Dict } from "@lindorm/types";

export type HermesScannerInput<T extends Dict = Dict> = Array<Constructor<T> | string>;
