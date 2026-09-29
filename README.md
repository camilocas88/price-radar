# Radar Precio

Radar de compras para Colombia. El MVP compara ofertas demo de un iPhone por precio real, disponibilidad y confianza. **No contiene integraciones comerciales reales ni scraping.**

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
| Mercado Libre, Éxito, Alkosto, Ktronix, Falabella, iShop, Mac Center | Demo/mock |
| Amazon, eBay, AliExpress | Demo/mock de importación |
| Instagram, Facebook, TikTok, WhatsApp | Solo enlace aportado por usuario |
| APIs, afiliados, feeds autorizados | Pendiente |

Los impuestos, conversión y entrega se etiquetan como estimados cuando no están confirmados. No se debe automatizar login, CAPTCHA, bloqueos o contenido contrario a los términos de una plataforma.

## Arquitectura y extensión

`src/lib` contiene normalización, cálculo de precio y score de confianza; los conectores futuros deben entregar el mismo modelo de oferta. Una extensión Chrome Manifest V3 deberá detectar URL/metadata de la pestaña, enviar una solicitud autenticada a una API compartida (`POST /api/compare-link`) y abrir el comparador. La extensión no debe extraer contenido restringido.

## Despliegue

- **Vercel:** despliegue principal; configurar `DATABASE_URL` y posteriormente `AUTH_SECRET`. Preview para PR y producción para `main`. Actualizaciones programadas: Vercel Cron llamando un endpoint protegido, respetando límites y costos.
- **GitHub Pages:** únicamente landing/documentación estática; no sirve para API, autenticación, cron ni PostgreSQL. Puede construirse como artefacto estático separado cuando exista repositorio remoto.
- **Dominio:** en Vercel añadir dominio, crear registro A/CNAME indicado por Vercel y verificar DNS; no comprar ni cambiar DNS sin autorización.

## Colaboración

Lee [AGENTS.md](AGENTS.md) antes de trabajar. Usar ramas `feature/<ticket>-<resumen>`, Conventional Commits y el ciclo de gates obligatorio.

## Roadmap

1. MVP local y demo vertical.
2. APIs oficiales/afiliados y feeds autorizados; sincronización y auditoría de ofertas.
3. Auth.js, alertas reales, historial persistente y cron.
4. Extensión Chrome Manifest V3.
5. Descubrimiento de tiendas públicas, aportes moderados y revisión de seguridad, cumplimiento y escalabilidad.
