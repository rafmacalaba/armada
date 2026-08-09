import { HashRouter } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import { App } from "./App";

export function Root() {
  useTheme();
  return (
    <HashRouter>
      <App />
    </HashRouter>
  );
}
