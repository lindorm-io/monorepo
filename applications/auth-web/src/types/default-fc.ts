import { FunctionComponent, ReactNode } from 'react';

type DefaultProps = {
  children?: ReactNode;
};

export type DefaultFC<T = Record<string, unknown>> = FunctionComponent<
  T & DefaultProps
>;
