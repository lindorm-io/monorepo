import type { IrisConnectionState } from "./connection";

export type IrisEvents = {
  "connection:state": [state: IrisConnectionState];
};
