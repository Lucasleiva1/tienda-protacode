# Prota Code — estado de continuidad

Última actualización: **29/08/2026**.

## Estado por partes

| Parte | Alcance | Estado |
|---|---|---|
| 1 | Fundación técnica | Terminada |
| 2 | Home | Terminada |
| 3 | Catálogo y ficha | Terminada |
| 4 | Carrito | Terminada |
| 5 | Checkout y pedidos | Terminada |
| 6 | Admin y persistencia | Terminada |
| 7 | Pagos multiproveedor y ciclo del pedido | Terminada |
| 8 | Fulfillment, RXW-CORE, acceso de compra y descargas | **Terminada y probada** |

## Parte 8 implementada

- `OrderPaidHandler` ejecuta fulfillment real y nunca revierte un pago aprobado por
  una falla posterior de licencia o descarga.
- RXW-CORE 0.8.0 está aislado detrás de `LicenseProvider`.
- `LICENSE_PROVIDER=none` es el valor seguro; `mock` queda bloqueado en producción.
- Cada artículo usa la clave estable `license:{orderId}:{productId}`.
- El estado persistente de la operación, el lease y CAS evitan dobles emisiones ante
  webhooks, llamadas o reintentos concurrentes.
- El panel permite reintentar una entrega sin modificar el estado del pago.
- Las licencias se revelan en Admin solo mediante una acción protegida explícita.
- El comprador accede por `/compras/[token]`; se persiste SHA-256 del token, no el
  token original, y Admin puede rotarlo.
- Las descargas se sirven mediante `POST`, sin token ni clave de Blob en la URL.
- Los instaladores son privados y se asocian por producto y versión con tamaño,
  SHA-256, MIME y fecha.
- Las copias de seguridad estándar omiten licencias, hashes de acceso y claves de
  almacenamiento.

## Verificaciones de la Parte 8

La suite cubre, entre otros casos:

- proveedor RXW deshabilitado sin licencias falsas;
- contrato HTTP exacto del adaptador RXW;
- doble webhook y concurrencia con una sola emisión;
- una licencia por cada artículo del pedido;
- falla parcial y reintento idempotente;
- bloqueo del mock en producción;
- token válido, token falso y rotación;
- autorización completa de descarga.

Comandos de cierre obligatorios:

```bash
npm run build
npm run lint
npx tsc --noEmit
npm test
```

## Para conectar producción

Todavía hacen falta decisiones y datos externos; no son código faltante de la Parte
8:

1. elegir e integrar el proveedor de pagos real;
2. configurar en Netlify `LICENSE_PROVIDER=rxw-core`, `RXW_CORE_BASE_URL`,
   `RXW_STORE_SERVICE_ID` y `RXW_STORE_SERVICE_SECRET`;
3. cargar y asociar el instalador real de cada producto/versión;
4. si un archivo supera 20 MB, incorporar almacenamiento privado con URL firmada,
   porque una Function transmitida de Netlify no puede entregarlo completo;
5. confirmar precios, contenidos de producto y páginas legales antes de vender.

No hay credenciales ni contraseñas escritas en este documento. La cuenta Admin se
configura con `npm run admin:clave`.

## Decisiones que se deben conservar

- Nunca aceptar desde el navegador precio, moneda, `appId`, versión ni estado de pago.
- Nunca aprobar un pedido desde un redirect o query string.
- Nunca exponer secretos RXW con `NEXT_PUBLIC_`.
- Nunca mostrar licencia ni descargar archivo si el pago persistido no está aprobado.
- Nunca cambiar un pedido a `fulfilled` mientras algún artículo carezca de licencia o
  descarga.
- No borrar versiones anteriores de instaladores distribuidos; el número de versión
  debe permanecer visible en el nombre.

La documentación operativa completa está en `README.md`.
