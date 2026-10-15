import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./estilos/base.css";
import "./estilos/barra.css";
import { ProveedorSesion } from "./estado/sesion.jsx";
import { ProveedorPlaza } from "./estado/plaza.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorPlaza>
          <App />
        </ProveedorPlaza>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
