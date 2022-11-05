import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { NextPage } from "next";
import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import { AuthenticationPageHeader } from "../../components/pages/authentication-page-header";
import { AuthenticationPageWrapper } from "../../components/pages/authentication-page-wrapper";
import { AuthenticationStrategy } from "../../enum/AuthenticationStrategy";
import { ClientConfig, InitialiseKey } from "../../types/configuration";
import { ConfirmationInputContainer } from "../../containers/input/confirmation-input-container";
import { InitialiseStrategyResponse } from "../../types/initialise-strategy-response";
import { Loader } from "../../components/loader/loader";
import { PendingResponseBody } from "../../types/get-authentication-info";
import { PrioritizedInputContainer } from "../../containers/input/prioritized-input-container";
import { RankedButtonsContainer } from "../../containers/input/ranked-buttons-container";
import { Typography } from "@mui/material";
import { localUrl } from "../../utils/local-url";
import { useRouter } from "next/router";

const Page: NextPage = () => {
  const router = useRouter();
  const [clientConfig, setClientConfig] = useState<Array<ClientConfig>>([]);
  const [defaultValue, setDefaultValue] = useState("");
  const [initialiseLoading, setInitialiseLoading] = useState<AuthenticationStrategy | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<AuthenticationMethod>();
  const [strategy, setStrategy] = useState<InitialiseStrategyResponse>();

  const getAuthentication = useCallback(() => {
    if (!router.isReady) return;
    if (!router.query.session_id) return;

    axios
      .get(localUrl("/api/sessions/authentication", { session_id: router.query.session_id }))
      .then((response) => {
        if (response.data.redirectTo) {
          window.location.replace(response.data.redirectTo);
        } else {
          const data = response.data as PendingResponseBody;

          setSelectedMethod(data.clientConfig[0].method);
          setClientConfig(data.clientConfig);

          const [primary] = data.clientConfig;

          switch (primary.hint) {
            case "email":
              setDefaultValue(response.data.emailHint);
              break;

            case "phone":
              setDefaultValue(response.data.phoneHint);
              break;

            default:
              break;
          }
        }
      });
  }, [router, setClientConfig, setDefaultValue, setSelectedMethod]);

  const onInitialise = useCallback(
    (strategy: AuthenticationStrategy, initialiseKey: InitialiseKey, value: string) => {
      if (!router.isReady) return;
      if (!router.query.session_id) return;

      setInitialiseLoading(strategy);

      axios
        .post<InitialiseStrategyResponse>(
          `http://localhost:3001/sessions/authentication/${router.query.session_id}/strategy`,
          {
            ...(initialiseKey !== "none" ? { [initialiseKey]: value } : {}),
            strategy,
          },
        )
        .then((response) => setStrategy(response.data))
        .finally(() => setInitialiseLoading(null));
    },
    [router, defaultValue, setInitialiseLoading, setStrategy],
  );

  const onConfirm = useCallback(
    (value: string, remember: boolean) => {
      if (!strategy) return;

      setConfirmLoading(true);

      axios
        .post(`http://localhost:3001/sessions/strategy/${strategy!.id}/confirm`, {
          ...(strategy!.confirm_key !== "none" ? { [strategy!.confirm_key]: value } : {}),
          strategy_session_token: strategy!.strategy_session_token,
          remember,
        })
        .then(getAuthentication)
        .finally(() => setConfirmLoading(false));
    },
    [strategy, setConfirmLoading, getAuthentication],
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (!router.query.session_id) {
      return window.location.replace("/api/authorize");
    }
    getAuthentication();
  }, [router]);

  return (
    <AuthenticationPageWrapper>
      {selectedMethod && !strategy ? (
        <>
          <AuthenticationPageHeader />
          <PrioritizedInputContainer
            clientConfig={clientConfig}
            defaultValue={defaultValue}
            loading={initialiseLoading}
            selectedMethod={selectedMethod}
            onClick={onInitialise}
          />
          <Typography
            variant="overline"
            color="common.gray"
          >
            You can also select another method
          </Typography>
          <RankedButtonsContainer
            clientConfig={clientConfig}
            disabled={!!initialiseLoading}
            selectedMethod={selectedMethod}
            onClick={setSelectedMethod}
          />
        </>
      ) : strategy ? (
        <>
          <AuthenticationPageHeader />
          <ConfirmationInputContainer
            loading={confirmLoading}
            strategy={strategy}
            onConfirm={onConfirm}
          />
        </>
      ) : (
        <Loader />
      )}
    </AuthenticationPageWrapper>
  );
};

export default Page;
