export interface IElasticEntity {
  id: string;
  primaryTerm: number;
  rev: number;
  seq: number;
  createdAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
}
