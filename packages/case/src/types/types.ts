import { Dict } from "@lindorm/types";

export type CaseCallback = (input: string) => string;

export type KeysInput = Dict | Array<Dict>;
