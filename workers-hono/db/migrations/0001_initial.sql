PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS outlets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_outlets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, outlet_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_outlet_roles (
    id TEXT PRIMARY KEY,
    user_outlet_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_outlet_id, role_id),
    FOREIGN KEY (user_outlet_id) REFERENCES user_outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    category_name TEXT,
    price_amount INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_outlet_stocks (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    on_hand_qty INTEGER NOT NULL DEFAULT 0,
    reserved_qty INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, outlet_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_stations (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outlet_id, slug),
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_station_devices (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK(device_type IN ('screen', 'printer')),
    device_name TEXT NOT NULL,
    target_ref TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES kitchen_stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_station_mappings (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    outlet_id TEXT,
    station_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, outlet_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES kitchen_stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cashier_shifts (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    opening_cash_amount INTEGER NOT NULL DEFAULT 0,
    closing_cash_amount INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'force_closed')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    cashier_id TEXT NOT NULL,
    cashier_shift_id TEXT,
    customer_name TEXT,
    transaction_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('draft', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL CHECK(status IS NOT NULL),
    subtotal_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_shift_id) REFERENCES cashier_shifts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_amount INTEGER NOT NULL DEFAULT 0,
    line_total_amount INTEGER NOT NULL DEFAULT 0,
    station_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (station_id) REFERENCES kitchen_stations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    ticket_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('pending_dispatch', 'dispatched', 'acknowledged', 'in_progress', 'ready', 'completed', 'cancelled')),
    dispatched_at TEXT,
    acknowledged_at TEXT,
    ready_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, station_id),
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES kitchen_stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
    id TEXT PRIMARY KEY,
    kitchen_ticket_id TEXT NOT NULL,
    transaction_item_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_ticket_id) REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_item_id) REFERENCES transaction_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_events (
    id TEXT PRIMARY KEY,
    kitchen_ticket_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_ticket_id) REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES kitchen_stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    outlet_id TEXT,
    user_id TEXT,
    module TEXT NOT NULL,
    event_name TEXT NOT NULL,
    target_ref TEXT,
    correlation_id TEXT,
    before_json TEXT,
    after_json TEXT,
    meta_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_outlets_user_id ON user_outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet_id ON user_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_outlet_stocks_outlet_id ON product_outlet_stocks(outlet_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_outlet_id ON kitchen_stations(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_station_mappings_station_id ON product_station_mappings(station_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_outlet_id ON kitchen_tickets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_station_id ON kitchen_tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_ticket_events_ticket_id ON kitchen_ticket_events(kitchen_ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outlet_id ON audit_logs(outlet_id);
