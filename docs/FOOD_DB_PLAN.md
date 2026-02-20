## Canon v1 Food DB Plan

### Goal
Use a list-first canon (`data/canon/source-canon-v1.json`) as the exact food set, then map every canon item to explicit nutrient source rows with deterministic server-side math and stable IDs.

### Source-of-Truth and Curation Artifacts
- `data/canon/source-canon-v1.json`
  - Founder-provided canon list (gold food set).
- `data/canon/source-canon-v1.flat.json`
  - Built canon rows with stable `canonical_id` and inherited metadata.
- `data/canon/source-canon-v1.manual-curation.json`
  - Per-canon-item source mapping (`fdc_id`, dataset, confidence, notes).
- `data/canon/source-canon-v1.supplemental-source-rows.json`
  - Supplemental nutrient vectors from approved online/external sources when local USDA CSV rows are insufficient.
- `data/canon/source-canon-v1.provenance.json`
  - Full provenance manifest by canon item (dataset/source kind/source row/confidence).
- `data/canon/founder-priority-aliases-v1.json`
  - Founder-priority alias overrides.
- Audit outputs:
  - `data/canon/source-canon-v1.match-audit.json`
  - `data/canon/source-canon-v1.reseed-preview.json`

### Curation Policy (Current)
- Canon list is fixed by founder intent; no extra foods are introduced.
- Curation is explicit and row-level; no hidden runtime substitutions.
- Strict reseed requires full canon coverage (`unresolved_count = 0`).
- Runtime map/parse flows are strict against canon IDs and usable rows.

### Schema (v1 Extensions)
`public.canonical_foods` includes:
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

### Build and Reseed Workflow
1. Build canon:
   - `npm run canon:build`
2. (Optional) draft curation candidates:
   - `npm run canon:curate:build`
3. Generate provenance manifest:
   - `npm run canon:provenance:build`
4. Dry-run strict reseed:
   - `npm run canon:reseed:dry`
   - outputs:
     - `data/canon/source-canon-v1.match-audit.json`
     - `data/canon/source-canon-v1.reseed-preview.json`
5. Apply replacement (requires Supabase service role env vars):
   - `npm run canon:reseed:apply`
   - snapshots old rows into backup tables
   - upserts canon rows
   - replaces alias + variant metadata
6. Run audits:
   - preview/local: `npm run canon:audit`
   - live-db: `npm run canon:audit:db`

### Runtime Scope
`parse-meal`, `search-foods`, and `map-foods` scope lookups to:
- `is_canon_v1 = true`
- `is_usable = true`

Alias-aware lookup uses:
- canonical row aliases (`canonical_foods.aliases`)
- alias table rows (`canonical_food_aliases`)
