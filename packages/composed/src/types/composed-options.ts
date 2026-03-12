export interface ComposedOptions {
  file: string;
  verbose: boolean;
  build: boolean;
  teardown: boolean;
  waitTimeout: number;
  command: string;
  commandArgs: Array<string>;
}
