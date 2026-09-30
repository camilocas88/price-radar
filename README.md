# Radar Precio

Radar de compras para Colombia. El MVP muestra una demo, intenta consultar la API oficial de Mercado Libre y permite comparar enlaces públicos aportados por usuarios. La búsqueda de Mercado Libre puede responder 403; en ese caso no se presentan ofertas demo como resultados reales.

## Ejecutar localmente

```bash
git clone <tu-repo>
cd radar-precio
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:push
npm run dev
```

Abre `http://localhost:3000`. La UI funciona sin credenciales con datos demo; PostgreSQL queda listo para persistencia posterior.

## Validación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Estado de fuentes

| Fuente | Estado MVP |
| --- | --- |
| Mercado Libre | API oficial de búsquedas (T-002); puede rechazar búsquedas con 403 incluso con credenciales |
| Enlaces aportados | Páginas HTTPS de Mercado Libre, Alkosto, Ktronix, Éxito y Falabella; JSON-LD `Product` cuando sea accesible y campos confirmados manualmente por el usuario |
| Éxito, Alkosto, Ktronix, Falabella, iShop, Mac Center | Demo/mock |
| Amazon, eBay, AliExpress | Demo/mock de importación |
| Instagram, Facebook, TikTok, WhatsApp | Solo enlace aportado por usuario |
| APIs, afiliados, feeds autorizados | Pendiente |

Los impuestos, conversión y entrega se etiquetan como estimados cuando no están confirmados. No se debe automatizar login, CAPTCHA, bloqueos o contenido contrario a los términos de una plataforma.

El campo principal acepta una búsqueda de texto o una URL pública. El texto va a Mercado Libre; la URL abre directamente el comparador de enlaces, sin depender de esa API. Puedes añadir dos o más enlaces en la sesión y ver el menor precio publicado en COP **entre esos enlaces** y la diferencia frente a los demás; no es una búsqueda automática del precio más barato de todo el mercado. No se verifican automáticamente variantes, precio final, inventario, envío, impuestos ni garantía. Si la página no expone JSON-LD público, pide título y precio. Los aportes no se guardan ni se mezclan con resultados confirmados de API.

## Arquitectura y extensión

`src/lib` contiene normalización, cálculo de precio y score de confianza; los conectores futuros deben entregar el mismo modelo de oferta. Una extensión Chrome Manifest V3 deberá detectar URL/metadata de la pestaña, enviar una solicitud autenticada a una API compartida (`POST /api/compare-link`) y abrir el comparador. La extensión no debe extraer contenido restringido.

## Despliegue

- **Vercel:** despliegue principal; configurar `DATABASE_URL` y posteriormente `AUTH_SECRET`. Preview para PR y producción para `main`. Actualizaciones programadas: Vercel Cron llamando un endpoint protegido, respetando límites y costos.
- **GitHub Pages:** únicamente landing/documentación estática; no sirve para API, autenticación, cron ni PostgreSQL. Puede construirse como artefacto estático separado cuando exista repositorio remoto.
- **Dominio:** en Vercel añadir dominio, crear registro A/CNAME indicado por Vercel y verificar DNS; no comprar ni cambiar DNS sin autorización.

## Colaboración

Lee [AGENTS.md](AGENTS.md) antes de trabajar. Usar ramas `feature/<ticket>-<resumen>`, Conventional Commits y el ciclo de gates obligatorio.

El [registro de features](docs/engineering/FEATURES.md) coordina el backlog y la asignación entre agentes. Ejecuta `npm run features:list` para ver estados y dueños; `npm run features:check` valida los registros. `done` significa listo para tu merge, mientras que solo el humano fusiona a `main`.

## Roadmap

1. MVP local y demo vertical.
2. APIs oficiales/afiliados y feeds autorizados; sincronización y auditoría de ofertas.
3. Auth.js, alertas reales, historial persistente y cron.
4. Extensión Chrome Manifest V3.
5. Descubrimiento de tiendas públicas, aportes moderados y revisión de seguridad, cumplimiento y escalabilidad.
