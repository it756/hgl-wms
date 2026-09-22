-- Migration: 045_reload_postgrest_schema_cache.sql
-- Purpose: Migrations 036-044 added new foreign keys and columns (notably
--          transfer_line_items.destination_unit_id -> sbu_units.id in 041)
--          without notifying PostgREST, so its cached relationship graph
--          never picked them up. This caused API errors such as:
--            "Could not find a relationship between 'transfer_line_items'
--             and 'sbu_units' in the schema cache"
--          Force a reload now, and going forward every migration that adds
--          tables/columns/FKs should end with this NOTIFY (see 034, 035).

NOTIFY pgrst, 'reload schema';
