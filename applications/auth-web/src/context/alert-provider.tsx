import { AlertColor } from "@mui/material";
import { DefaultFC } from "../types/default-fc";
import { getDuration } from "../utils/get-duration";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ContextState = {
  duration: number;
  open: boolean;
  severity: AlertColor;
  text: string | null;
};

type ContextFunctions = {
  closeAlert(): void;
  openAlert(severity: AlertColor, text: string): void;
  onError(text: string): (err: Error) => void;
  onWarning(text: string): () => void;
  onInfo(text: string): () => void;
  onSuccess(text: string): () => void;
};

type ContextValue = ContextState & ContextFunctions;

const AlertContext = createContext<ContextValue>({
  duration: 6000,
  open: false,
  severity: "info",
  text: null,

  closeAlert: () => undefined,
  openAlert: () => undefined,
  onError: () => () => undefined,
  onWarning: () => () => undefined,
  onInfo: () => () => undefined,
  onSuccess: () => () => undefined,
});

export const AlertContextProvider: DefaultFC = ({ children }) => {
  // initialisation

  const [state, setState] = useState<ContextState>({
    duration: 6000,
    open: false,
    severity: "info",
    text: null,
  });

  // functions

  const closeAlert = useCallback(
    () =>
      setState((state) => ({
        ...state,
        open: false,
        severity: "info",
        text: null,
      })),
    [setState],
  );

  const openAlert = useCallback(
    (severity: AlertColor, text: string) =>
      setState((state) => ({
        ...state,
        duration: getDuration(severity),
        open: true,
        severity,
        text,
      })),
    [setState],
  );

  const onError = useCallback(
    (text: string) => (err: Error) => {
      console.error(text);
      console.error(err);
      openAlert("error", text);
    },
    [openAlert],
  );

  const onWarning = useCallback((text: string) => () => openAlert("warning", text), [openAlert]);

  const onInfo = useCallback((text: string) => () => openAlert("info", text), [openAlert]);

  const onSuccess = useCallback((text: string) => () => openAlert("success", text), [openAlert]);

  // provider

  const contextValue: ContextValue = useMemo(
    () => ({
      ...state,

      closeAlert,
      openAlert,

      onError,
      onWarning,
      onInfo,
      onSuccess,
    }),
    [state, closeAlert, openAlert, onError, onWarning, onInfo, onSuccess],
  );

  return <AlertContext.Provider value={contextValue}>{children}</AlertContext.Provider>;
};

export const useAlertContext = (): ContextValue => useContext<ContextValue>(AlertContext);
