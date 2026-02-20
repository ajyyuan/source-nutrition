## Canon v1 Food DB Plan

### Goal
Hard-reset the live canonical catalog to a list-first canon (`data/canon/source-canon-v1.json`), then attach USDA nutrients deterministically while keeping stable IDs and deterministic nutrient math.

### Canon Source Artifacts
- `data/canon/source-canon-v1.json`
  - Founder-provided source of truth list.
- `data/canon/source-canon-v1.flat.json`
  - Flattened canon rows with stable `canonical_id` and inherited taxonomy metadata.
- `data/canon/source-canon-v1.source-audit.json`
  - Source integrity checks (counts, duplicates).
- `data/canon/founder-priority-aliases-v1.json`
  - Extra synonyms for founder-priority terms.

### Schema (v1 Extensions)
`public.canonical_foods` now includes:
- taxonomy metadata: `display_name`, `kingdom`, `domain`, `food_group`, `subgroup`, `default_state`
- canon metadata: `aliases`, `variant_template_id`, `variant_values`, `notes`
- curation flags: `is_canon_v1`, `is_usable`
- match metadata: `match_status`, `match_source`, `match_confidence`

Related tables:
- `public.canonical_food_aliases`
- `public.canonical_variant_dimensions`
- `public.canonical_variant_templates`
- `public.canonical_variant_template_dimensions`
- backup snapshots:
  - `public.canonical_foods_backups`
  - `public.canonical_food_aliases_backups`

### Reseed Workflow
1. Build flat canon:
   - `npm run canon:build`
2. Dry-run match + preview + audit:
   - `npm run canon:reseed:dry`
   - outputs:
     - `data/canon/source-canon-v1.match-audit.json`
     - `data/canon/source-canon-v1.reseed-preview.json`
3. Apply hard replacement (requires Supabase service role env vars):
   - `npm run canon:reseed:apply`
   - snapshots old rows into backup tables
   - upserts canon v1 rows
   - replaces alias + variant metadata
4. Run audits:
   - preview/local: `npm run canon:audit`
   - live-db post-cutover: `npm run canon:audit:db`

### Runtime Scope
`parse-meal`, `search-foods`, and `map-foods` now scope canonical lookups to:
- `is_canon_v1 = true`
- `is_usable = true`

Alias-aware lexical ranking uses both:
- canonical row aliases (`canonical_foods.aliases`)
- alias table rows (`canonical_food_aliases`)
