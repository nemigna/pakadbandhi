import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { ProjectProvider } from "./state/project-context";
import "./styles/globals.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectProvider enableCloud>
      <App />
    </ProjectProvider>
  </React.StrictMode>,
);
