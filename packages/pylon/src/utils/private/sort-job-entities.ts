import { IQueueableEntity } from "../../interfaces";

export const sortJobEntities = (a: IQueueableEntity, b: IQueueableEntity): number => {
  if (a.priority === b.priority) {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  return (b.priority ?? 1) - (a.priority ?? 1);
};
