import { PylonSocketData } from "../../types";

export const initialisePylonSocketData = <D extends PylonSocketData>(): D => {
  const data: PylonSocketData = {
    tokens: {},
  };

  return data as D;
};
