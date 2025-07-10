import { Command } from "../../../decorators";

@Command()
export class TestCommandDispatch {
  public constructor(public readonly input: any) {}
}
