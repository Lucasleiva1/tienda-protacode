"use client";

import { useEffect } from "react";

/**
 * Avisa al servidor que alguien entró a la tienda.
 *
 * El navegador recuerda el día ya avisado y no vuelve a llamar hasta el día
 * siguiente, aunque haya varias pestañas o React ejecute el efecto dos veces. El
 * servidor además deduplica con su propia cookie. El pedido va vacío: no se manda
 * nada del visitante.
 */

const CLAVE = "pc_visita";
let enviadoEnEstaCarga = false;

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function VisitTracker() {
  useEffect(() => {
    if (enviadoEnEstaCarga || navigator.webdriver) return;
    enviadoEnEstaCarga = true;

    const hoy = hoyEnArgentina();
    try {
      if (localStorage.getItem(CLAVE) === hoy) return;
      // Se marca antes de enviar: otra pestaña abierta al mismo tiempo ya no llama.
      localStorage.setItem(CLAVE, hoy);
    } catch {
      // Sin almacenamiento (modo privado estricto): decide solo la cookie del servidor.
    }

    void fetch("/api/visitas", { method: "POST", keepalive: true, credentials: "same-origin" }).catch(
      () => undefined,
    );
  }, []);
  return null;
}
