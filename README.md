# Prota Code

Tienda de software construida con Next.js, TypeScript y Netlify Blobs. Incluye
catálogo, carrito, checkout, pedidos, pagos desacoplados, panel de administración y
entrega protegida de licencias e instaladores.

El panel de administración permite crear, editar, publicar, ocultar y archivar
programas. La eliminación permanente aparece únicamente después de archivar el
producto y exige una confirmación; no elimina pedidos ni entregas históricas.

## Desarrollo local

Requisitos: Node.js compatible con Next.js 16 y npm.

```bash
npm install
Copy-Item .env.example .env.local
npm run admin:clave
npm run dev
```

La tienda queda disponible en `http://localhost:3000` y el panel en
`http://localhost:3000/admin`.

## Pedidos por WhatsApp

Mientras no haya una pasarela de pago, el checkout guarda el pedido y abre
WhatsApp con la referencia, los programas y el total ya preparados. Configurá:

```dotenv
SALES_CHANNEL=whatsapp
WHATSAPP_NUMBER=5491150540281
```

El número debe incluir el código de país. Después del primer deploy se puede cambiar
desde **Admin → Configuración**; el valor administrado se guarda en Netlify Blobs y
tiene prioridad sobre la variable de entorno. El cliente revisa y envía el mensaje
desde WhatsApp; abrir el chat no confirma ningún pago ni habilita automáticamente una
descarga.

## Cuentas de clientes

El checkout exige una cuenta. El cliente puede registrarse con email y contraseña o
usar Google. Las cuentas se guardan en `prota-code-customers` (Netlify Blobs) y las
sesiones viajan en cookies firmadas `HttpOnly`.

Las cuentas creadas con contraseña reciben un enlace de confirmación de un solo uso,
válido durante 24 horas. Hasta confirmarlo pueden iniciar sesión, pero no crear
pedidos. Las cuentas de Google quedan confirmadas cuando Google devuelve un email
verificado y el servidor valida el token de identidad.

Para Google, creá un cliente OAuth de tipo **Aplicación web** y configurá en Netlify:

```dotenv
CUSTOMER_SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

La URI autorizada de producción es
`https://TU-DOMINIO/api/auth/google/callback`; para desarrollo,
`http://localhost:3000/api/auth/google/callback`.

Para enviar la confirmación por email, configurá también estas variables privadas en
Netlify. `PUBLIC_SITE_URL` debe ser el origen HTTPS final, sin rutas:

```dotenv
PUBLIC_SITE_URL=https://tu-dominio.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Prota Code <ventas@tu-dominio.com>
```

Si faltan, la cuenta se crea y el panel informa que el envío no está configurado;
el administrador nunca muestra la contraseña SMTP.

## Variables de entorno

Nunca expongas estas variables con el prefijo `NEXT_PUBLIC_`.

```dotenv
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
CUSTOMER_SESSION_SECRET=

PUBLIC_SITE_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

PAYMENT_PROVIDER=none
SALES_CHANNEL=whatsapp
WHATSAPP_NUMBER=
LICENSE_PROVIDER=none

RXW_CORE_BASE_URL=
RXW_STORE_SERVICE_ID=
RXW_STORE_SERVICE_SECRET=
```

Valores de `LICENSE_PROVIDER`:

- `none`: estado seguro predeterminado; el pedido pagado conserva la entrega pendiente.
- `mock`: únicamente desarrollo y pruebas. Producción lo bloquea.
- `rxw-core`: usa el contrato real de RXW-CORE 0.8.0.

No hay proveedor de pagos real configurado. `PAYMENT_PROVIDER=none` no simula pagos
aprobados ni permite aprobarlos desde el panel.

## Flujo de entrega

Un pago solo se considera aprobado después de un evento verificado por el adaptador
del proveedor. En ese momento el fulfillment:

1. confirma de nuevo el pedido y el registro de pago persistido;
2. emite una licencia por producto mediante una clave de idempotencia estable;
3. asocia el instalador privado correspondiente a la versión comprada;
4. marca el pedido `fulfilled` únicamente cuando todos los artículos tienen licencia
   e instalador;
5. habilita `/compras/[token]`, cuyo token aleatorio se guarda solo como hash.

RXW-CORE recibe `POST /api/licenses/issue` con autenticación Bearer y
`X-RXW-Service-Id`. Las credenciales, tokens y licencias no se escriben en logs ni en
las copias de seguridad estándar.

## Instaladores privados

Formatos admitidos: `.exe`, `.msi`, `.zip`, `.dmg` y `.apk`. El nombre debe incluir
una versión visible, por ejemplo `whisper-v1.2.0.exe`.

Desarrollo local:

```bash
npm run descarga:importar -- --product whisper --file "C:\ruta\whisper-v1.2.0.exe"
```

Netlify:

1. subí el archivo directamente al Blob privado indicado por el panel del producto;
2. en `/admin/programas/[id]`, registrá clave, tamaño, SHA-256, MIME y fecha;
3. el servidor verifica que el Blob exista antes de asociarlo.

No se usa un formulario de upload de Function porque el cuerpo binario efectivo de
una Function síncrona ronda 4,5 MB. La descarga protegida por Function tiene un
límite de respuesta transmitida de 20 MB; instaladores mayores requieren un
proveedor de objetos privados con URLs firmadas antes de publicar.

## Almacenamiento

En local se usa `.data/`; en Netlify, stores privados de Netlify Blobs. Los stores
principales son productos, pedidos, pagos, fulfillment, accesos de compra, metadatos
de descarga e instaladores. Las operaciones críticas usan creación condicional y
CAS para resistir webhooks o reintentos concurrentes.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm test
npm run admin:clave
npm run seed:productos
npm run descarga:importar -- --help
```

## Publicación en Netlify

`netlify.toml` usa `npm run build` y publica `.next`. Antes de publicar:

- cargá las variables de entorno únicamente en el servidor;
- conectá y verificá un proveedor de pagos real;
- configurá `LICENSE_PROVIDER=rxw-core` y las tres variables RXW;
- asociá un instalador privado a cada producto y versión vendidos;
- resolvé la entrega de archivos superiores a 20 MB;
- ejecutá build, lint, TypeScript y tests.

## Seguridad relevante

- El navegador nunca decide precios, importes, estado de pago ni licencias.
- Los redirects de pago no aprueban pedidos.
- La licencia aparece únicamente tras pago aprobado y emisión confirmada.
- Las descargas requieren token válido, coincidencia exacta de pedido/producto,
  licencia emitida y pago aprobado.
- El token no viaja en la URL de descarga ni se persiste en texto plano.
- La clave interna del Blob no se entrega al catálogo ni a la ficha pública.
- Las contraseñas se guardan con `scrypt`, nunca en texto plano, y tienen un límite
  de longitud para evitar abuso de CPU.
- Los enlaces de confirmación son aleatorios, expiran en 24 horas, se usan una sola
  vez y se persisten únicamente como SHA-256.
- Registro, inicio de sesión y confirmación tienen límites de intentos persistentes
  compartidos por las Functions.
- Las cookies de sesión son firmadas, `HttpOnly`, `SameSite=Lax` y `Secure` en
  producción; el sitio agrega encabezados contra embedding, MIME sniffing y fuga de
  URL por referer.
