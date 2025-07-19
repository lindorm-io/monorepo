export interface IQueueableEntity {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  acknowledgedAt: Date | null;
  failedAt: Date | null;

  priority: number;
}
