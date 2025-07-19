import { Dict } from "@lindorm/types";
import { IQueueableEntity } from "./QueueableEntity";

export interface IJob {
  event: string;
  payload: Dict;
  priority: number;
}

export interface IJobEntity extends IJob, IQueueableEntity {}
