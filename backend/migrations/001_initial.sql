-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'шт',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sku_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES skus(id),
    barcode TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (warehouse_id, code)
);

CREATE TABLE lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES skus(id),
    lot_code TEXT NOT NULL,
    production_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sku_id, lot_code)
);

CREATE TYPE operation_type AS ENUM ('receipt', 'issue', 'transfer', 'adjustment');
CREATE TYPE operation_status AS ENUM ('applied', 'rejected');

CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type operation_type NOT NULL,
    reason_code TEXT,
    source_device_id TEXT NOT NULL,
    operation_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status operation_status NOT NULL DEFAULT 'applied',
    error_code TEXT,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_device_id, operation_key)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES operations(id),
    sku_id UUID NOT NULL REFERENCES skus(id),
    lot_id UUID REFERENCES lots(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID REFERENCES locations(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES skus(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    lot_id UUID REFERENCES lots(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (sku_id, location_id, lot_id)
);

CREATE TABLE sync_events (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_sku ON stock_movements(sku_id, occurred_at);
CREATE INDEX idx_stock_movements_operation ON stock_movements(operation_id);
CREATE INDEX idx_stock_balances_sku ON stock_balances(sku_id);
CREATE INDEX idx_stock_balances_location ON stock_balances(location_id);
CREATE INDEX idx_sync_events_seq ON sync_events(id);
CREATE INDEX idx_lots_expiry ON lots(expiry_date);

-- +goose Down
DROP TABLE IF EXISTS sync_events;
DROP TABLE IF EXISTS stock_balances;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS operations;
DROP TABLE IF EXISTS lots;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS sku_barcodes;
DROP TABLE IF EXISTS skus;
DROP TYPE IF EXISTS operation_status;
DROP TYPE IF EXISTS operation_type;
