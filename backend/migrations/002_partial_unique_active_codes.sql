-- Soft-deleted rows must not block reuse of the same code.
-- Uniqueness applies only to active warehouses/locations.

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_warehouse_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS locations_warehouse_id_code_active_key
    ON locations (warehouse_id, code)
    WHERE is_active = true;

ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_active_key
    ON warehouses (code)
    WHERE is_active = true;
