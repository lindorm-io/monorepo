import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import type { AppProps } from "next/app";
import { AlertContainer } from "../containers/alert/alert-container";
import { AlertContextProvider } from "../context/alert-provider";
import { CssBaseline } from "@mui/material";
import { MaterialThemeProvider } from "../context/material-theme-provider";
import { combineComponents } from "../utils/combine-components";

export const CombinedProviders = combineComponents(MaterialThemeProvider, AlertContextProvider);

const App = ({ Component, pageProps }: AppProps) => (
  <CombinedProviders>
    <CssBaseline />
    <AlertContainer />
    <Component {...pageProps} />
  </CombinedProviders>
);

export default App;
