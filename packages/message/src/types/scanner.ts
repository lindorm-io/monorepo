import { Constructor, Dict } from "@lindorm/types";

export type MessageScannerInput<T extends Dict = Dict> = Array<Constructor<T> | string>;
