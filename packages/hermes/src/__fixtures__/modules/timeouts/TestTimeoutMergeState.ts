import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutMergeState {
  public constructor(public readonly input: any) {}
}
