import { Constructor } from "@lindorm/types";
import { IMongoFile } from "../interfaces";

export type FileScannerInput = Array<Constructor<IMongoFile> | string>;
