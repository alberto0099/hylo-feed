import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Cotilleo from "./Cotilleo.tsx";

// Dos pantallas, sin router: la pública (el feed) y la de Fabio. Para una
// ruta no compensa meter react-router y 20 kB de dependencia.
const enCotilleo = window.location.pathname.startsWith("/cotilleo");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{enCotilleo ? <Cotilleo /> : <App />}</StrictMode>,
);
