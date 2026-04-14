# moon-lead-finder

Actor de Apify orientado a Moon Shared Living para encontrar **particulares** que publican habitaciones y pisos en alquiler en Madrid, Barcelona y sus áreas objetivo.

## Qué hace

- Busca páginas públicas relacionadas con alquiler de habitaciones y pisos.
- Intenta detectar si el anuncio parece de **particular** o de **agencia**.
- Extrae contactos públicos.
- Normaliza y valida teléfonos españoles.
- Devuelve solo leads útiles para captación de oferta.

## Campos principales del output

- `listingTitle`
- `listingUrl`
- `city`
- `propertyType`
- `email`
- `phoneRaw`
- `phoneNormalized`
- `isSpanishPhoneValid`
- `ownerLikely`
- `agencyLikely`
- `confidenceScore`
- `whyQualified`

## Input de ejemplo

```json
{
  "regions": ["Madrid", "Barcelona", "Comunidad de Madrid", "Área Metropolitana de Barcelona"],
  "propertyTypes": ["room", "flat"],
  "ownerOnly": true,
  "requireEmailOrPhone": true,
  "requireSpanishPhone": true,
  "maxResultsPerQuery": 20,
  "maxPagesPerSite": 3,
  "allowedDomains": []
}
```

## Ejecución local

```bash
npm install
npm start
```

## Importar en Apify

1. Importa el repo desde GitHub.
2. Lanza un build.
3. Ejecuta con el input de ejemplo.

## Nota

Este actor usa heurísticas para separar particulares de agencias. Conviene revisar resultados y luego enriquecer / deduplicar en Supabase o CRM.
