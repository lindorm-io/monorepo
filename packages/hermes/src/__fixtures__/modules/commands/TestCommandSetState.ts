import { Command } from "../../../decorators";

@Command()
export class TestCommandSetState {
  public constructor(public readonly input: any) {}
}
