import type { IrisConnectionState } from "./connection.js";

export type IrisEvents = {
  "connection:state": [state: IrisConnectionState];
};
