import { Command } from "../../../src";

@Command()
export class ExampleCommandSetState {
  public constructor(public readonly input: any) {}
}
