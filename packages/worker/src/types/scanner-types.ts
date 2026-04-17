import { ILindormWorker } from "../interfaces";
import { LindormWorkerConfig } from "./worker";

export type LindormWorkerScannerInput = Array<
  ILindormWorker | LindormWorkerConfig | string
>;

export type LindormWorkerScannerOutput = Array<ILindormWorker | LindormWorkerConfig>;
