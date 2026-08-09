import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./Root";
import "./styles/theme.css";
import "./styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
