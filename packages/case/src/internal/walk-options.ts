export type WalkOptions = {
  depth: number;
  exempt: (key: string) => boolean;
};
