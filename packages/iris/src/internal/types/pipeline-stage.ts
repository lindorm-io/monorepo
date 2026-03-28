export type FilterStage = {
  type: "filter";
  predicate: (msg: any) => boolean;
};

export type MapStage = {
  type: "map";
  transform: (msg: any) => any;
};

export type FlatMapStage = {
  type: "flatMap";
  transform: (msg: any) => Array<any>;
};

export type BatchStage = {
  type: "batch";
  size: number;
  timeout?: number;
};

export type PipelineStage = FilterStage | MapStage | FlatMapStage | BatchStage;
