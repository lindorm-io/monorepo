export type ProteusResult<R = unknown> = {
  rows: Array<R>;
  rowCount: number;
};
