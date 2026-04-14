# moon-lead-finder

Actor de Apify para encontrar y puntuar leads B2B útiles para Moon Shared Living.

## Qué hace

Busca operadores y empresas relacionadas con:
- coliving
- alquiler por habitaciones
- residencias de estudiantes
- relocation housing
- property managers
- shared living

Luego visita sus webs, extrae datos de contacto y devuelve un `fitScore` para priorizar outreach y partnerships.

## Stack

- Node.js
- Apify SDK
- Crawlee
- CheerioCrawler

## Estructura

```text
moon-lead-finder/
├─ src/
│  ├─ main.js
│  ├─ scoring.js
│  └─ utils.js
├─ package.json
├─ apify.json
├─ Dockerfile
├─ INPUT_SCHEMA.json
├─ .gitignore
└─ README.md
```

## Input de ejemplo

```json
{
  "cities": ["Madrid", "Barcelona", "Valencia"],
  "countries": ["Spain"],
  "keywords": [
    "coliving",
    "alquiler habitaciones",
    "residencia estudiantes",
    "shared living",
    "relocation housing"
  ],
  "maxResultsPerQuery": 10,
  "allowedDomains": [],
  "maxPagesPerSite": 3
}
```

## Output de ejemplo

```json
{
  "companyName": "Example Coliving Madrid",
  "website": "https://example.com",
  "city": "Madrid",
  "country": "Spain",
  "leadType": "coliving",
  "emails": ["hello@example.com"],
  "phones": ["+34 600 000 000"],
  "linkedinUrl": "https://www.linkedin.com/company/example",
  "contactPage": "https://example.com/contact",
  "aboutSnippet": "Flexible coliving for students and young professionals...",
  "sourceUrl": "https://example.com",
  "fitScore": 78,
  "whyFit": "Tiene email público | Tiene página de contacto | Match fuerte: coliving",
  "crawledAt": "2026-04-15T12:00:00.000Z",
  "pageType": "SITE"
}
```

## Ejecución local

```bash
npm install
npm start
```

Para correr con input local:

```bash
apify run --input-file=input.json
```

## Subir a Apify

### Opción 1: Importar desde GitHub
1. Crea un repo nuevo en GitHub llamado `moon-lead-finder`
2. Sube estos archivos
3. En Apify, crea un Actor nuevo desde Git repo
4. Selecciona el repositorio
5. Build y Run

### Opción 2: CLI/API
Después de crear el actor, podrás ejecutarlo por API con el input JSON.

## Notas

- Empieza con pocas ciudades y `maxResultsPerQuery` bajo para no quemar créditos.
- Usa `allowedDomains` si quieres limitar el scraping a directorios o verticales concretos.
- El scoring está pensado para priorizar leads comerciales, no para máxima exhaustividad.
