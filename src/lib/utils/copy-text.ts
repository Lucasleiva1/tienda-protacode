/**
 * Copiar texto al portapapeles.
 *
 * `navigator.clipboard` no existe siempre: en una dirección sin HTTPS (por ejemplo
 * http://192.168.0.10:3000 desde el celular) el navegador ni lo expone. Por eso hay
 * un segundo camino con un campo invisible y `execCommand`, que es viejo pero sigue
 * funcionando en ese caso.
 *
 * Devuelve `true` solo si de verdad se copió.
 */
export async function copyText(valor: string): Promise<boolean> {
  if (valor === "") return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // Sin permiso o sin activación del usuario: se prueba el camino de abajo.
  }

  try {
    const campo = document.createElement("textarea");
    campo.value = valor;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const copiado = document.execCommand("copy");
    document.body.removeChild(campo);
    return copiado;
  } catch {
    return false;
  }
}
