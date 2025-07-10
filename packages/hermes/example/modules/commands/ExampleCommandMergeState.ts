import { Command } from "../../../src";

@Command()
export class ExampleCommandMergeState {
  public constructor(public readonly input: any) {}
}
