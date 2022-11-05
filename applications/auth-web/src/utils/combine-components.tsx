import React, { ComponentProps, ReactElement } from "react";
import { DefaultFC } from "../types/default-fc";

export const combineComponents = (...components: Array<DefaultFC>): DefaultFC =>
  components.reduce(
    (AccumulatedComponents, CurrentComponent) =>
      // eslint-disable-next-line react/display-name
      ({ children }: ComponentProps<DefaultFC>): ReactElement =>
        (
          <AccumulatedComponents>
            <CurrentComponent>{children}</CurrentComponent>
          </AccumulatedComponents>
        ),
    ({ children }) => <>{children}</>,
  );
