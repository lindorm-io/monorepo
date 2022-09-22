import React, { FunctionComponent, ReactElement } from "react";
import { AuthenticationStrategy } from "../../enum/AuthenticationStrategy";
import { ClientConfig, InitialiseKey } from "../../types/configuration";
import { PrimaryActionButton } from "../button/primary-action-button";
import { SecondaryActionButton } from "../button/secondary-action-button";

type Props = {
  clientConfig: ClientConfig;
  loading: AuthenticationStrategy | null;
  value: string;
  onClick(strategy: AuthenticationStrategy, initialiseKey: InitialiseKey, value: string): void;
};

export const PrioritizedInputButton: FunctionComponent<Props> = ({
  clientConfig,
  loading,
  value,
  onClick,
}) => {
  const [primary, ...secondary] = clientConfig.strategies;

  return (
    <>
      <PrimaryActionButton
        disabled={!!loading && loading !== primary}
        loading={loading === primary}
        onClick={() => onClick(primary, clientConfig.initialiseKey, value)}
      >
        {primary}
      </PrimaryActionButton>
      <>
        {secondary.map((strategy) => (
          <SecondaryActionButton
            key={strategy}
            disabled={!!loading && loading !== strategy}
            loading={loading === strategy}
            onClick={() => onClick(strategy, clientConfig.initialiseKey, value)}
          >
            {strategy}
          </SecondaryActionButton>
        ))}
      </>
    </>
  );
};
