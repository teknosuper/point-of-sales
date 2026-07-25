-- Cleanup transaksi lama/testing.
-- Asumsi:
-- - transaksi asli pertama dimulai dari transactions.id = 2966
-- - semua transactions.id < 2966 boleh dibersihkan
-- - master data seperti products, customers, suppliers, outlets, users tetap dipertahankan
--
-- Jalankan bertahap:
-- 1. backup database dulu
-- 2. review hasil preview SELECT
-- 3. baru jalankan seluruh script

SET @first_real_transaction_id := 2966;

DROP TEMPORARY TABLE IF EXISTS tmp_target_transactions;
CREATE TEMPORARY TABLE tmp_target_transactions (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT t.id
FROM transactions t
WHERE t.id < @first_real_transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_transaction_details;
CREATE TEMPORARY TABLE tmp_target_transaction_details (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT td.id
FROM transaction_details td
JOIN tmp_target_transactions tt ON tt.id = td.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_sales_returns;
CREATE TEMPORARY TABLE tmp_target_sales_returns (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT sr.id
FROM sales_returns sr
JOIN tmp_target_transactions tt ON tt.id = sr.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_receivables;
CREATE TEMPORARY TABLE tmp_target_receivables (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT r.id
FROM receivables r
JOIN tmp_target_transactions tt ON tt.id = r.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_kitchen_tickets;
CREATE TEMPORARY TABLE tmp_target_kitchen_tickets (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT kt.id
FROM kitchen_tickets kt
JOIN tmp_target_transactions tt ON tt.id = kt.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_tenant_allocations;
CREATE TEMPORARY TABLE tmp_target_tenant_allocations (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT tta.id
FROM transaction_tenant_allocations tta
JOIN tmp_target_transactions tt ON tt.id = tta.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_target_table_orders;
CREATE TEMPORARY TABLE tmp_target_table_orders (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT `to`.id
FROM table_orders `to`
JOIN tmp_target_transactions tt ON tt.id = `to`.transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_impacted_customers;
CREATE TEMPORARY TABLE tmp_impacted_customers (
    customer_id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT DISTINCT t.customer_id
FROM transactions t
JOIN tmp_target_transactions tt ON tt.id = t.id
WHERE t.customer_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_target_cashier_shifts;
CREATE TEMPORARY TABLE tmp_target_cashier_shifts (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT DISTINCT shift_id AS id
FROM (
    SELECT t.cashier_shift_id AS shift_id
    FROM transactions t
    JOIN tmp_target_transactions tt ON tt.id = t.id
    WHERE t.cashier_shift_id IS NOT NULL

    UNION

    SELECT sr.cashier_shift_id AS shift_id
    FROM sales_returns sr
    JOIN tmp_target_sales_returns tsr ON tsr.id = sr.id
    WHERE sr.cashier_shift_id IS NOT NULL
) candidate_shifts
WHERE shift_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM transactions t_keep
      WHERE t_keep.cashier_shift_id = candidate_shifts.shift_id
        AND t_keep.id >= @first_real_transaction_id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM sales_returns sr_keep
      WHERE sr_keep.cashier_shift_id = candidate_shifts.shift_id
        AND sr_keep.id NOT IN (SELECT id FROM tmp_target_sales_returns)
  );

DROP TEMPORARY TABLE IF EXISTS tmp_target_settlement_requests;
CREATE TEMPORARY TABLE tmp_target_settlement_requests (
    id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=Memory
AS
SELECT csr.id
FROM cashier_settlement_requests csr
JOIN tmp_target_cashier_shifts tcs ON tcs.id = csr.cashier_shift_id;

DROP TEMPORARY TABLE IF EXISTS tmp_stock_reversal;
CREATE TEMPORARY TABLE tmp_stock_reversal (
    outlet_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_delta BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (outlet_id, product_id)
) ENGINE=Memory
AS
SELECT
    sm.outlet_id,
    sm.product_id,
    SUM(
        CASE
            WHEN sm.mutation_type = 'out' THEN sm.qty
            WHEN sm.mutation_type = 'in' THEN -sm.qty
            ELSE 0
        END
    ) AS product_delta
FROM stock_mutations sm
WHERE
    (sm.reference_type = 'transaction' AND sm.reference_id IN (SELECT id FROM tmp_target_transactions))
    OR
    (sm.reference_type = 'sales_return' AND sm.reference_id IN (SELECT id FROM tmp_target_sales_returns))
GROUP BY sm.outlet_id, sm.product_id;

-- Preview
SELECT 'target_transactions' AS label, COUNT(*) AS total FROM tmp_target_transactions
UNION ALL
SELECT 'target_transaction_details', COUNT(*) FROM tmp_target_transaction_details
UNION ALL
SELECT 'target_sales_returns', COUNT(*) FROM tmp_target_sales_returns
UNION ALL
SELECT 'target_receivables', COUNT(*) FROM tmp_target_receivables
UNION ALL
SELECT 'target_kitchen_tickets', COUNT(*) FROM tmp_target_kitchen_tickets
UNION ALL
SELECT 'target_tenant_allocations', COUNT(*) FROM tmp_target_tenant_allocations
UNION ALL
SELECT 'target_table_orders', COUNT(*) FROM tmp_target_table_orders
UNION ALL
SELECT 'target_cashier_shifts', COUNT(*) FROM tmp_target_cashier_shifts
UNION ALL
SELECT 'target_settlement_requests', COUNT(*) FROM tmp_target_settlement_requests
UNION ALL
SELECT 'impacted_customers', COUNT(*) FROM tmp_impacted_customers;

SELECT t.id, t.invoice, t.created_at, t.customer_id, t.outlet_id, t.grand_total
FROM transactions t
JOIN tmp_target_transactions tt ON tt.id = t.id
ORDER BY t.id DESC
LIMIT 50;

START TRANSACTION;

-- Lepaskan voucher yang dipakai oleh transaksi lama
UPDATE customer_vouchers
SET
    is_used = 0,
    used_at = NULL,
    used_transaction_id = NULL
WHERE used_transaction_id IN (SELECT id FROM tmp_target_transactions);

-- Balikkan efek stok dari transaksi / sales return yang akan dihapus
UPDATE product_outlet_stocks pos
JOIN tmp_stock_reversal sr
    ON sr.outlet_id = pos.outlet_id
   AND sr.product_id = pos.product_id
SET pos.stock = GREATEST(0, pos.stock + sr.product_delta);

UPDATE products p
JOIN (
    SELECT product_id, SUM(product_delta) AS product_delta
    FROM tmp_stock_reversal
    GROUP BY product_id
) sr ON sr.product_id = p.id
SET p.stock = GREATEST(0, p.stock + sr.product_delta);

-- Child tables paling bawah
DELETE FROM transaction_detail_modifiers
WHERE transaction_detail_id IN (SELECT id FROM tmp_target_transaction_details);

DELETE FROM sales_return_items
WHERE sales_return_id IN (SELECT id FROM tmp_target_sales_returns)
   OR transaction_detail_id IN (SELECT id FROM tmp_target_transaction_details);

DELETE FROM customer_credits
WHERE sales_return_id IN (SELECT id FROM tmp_target_sales_returns);

DELETE FROM receivable_payments
WHERE receivable_id IN (SELECT id FROM tmp_target_receivables);

DELETE FROM table_order_item_modifiers
WHERE table_order_item_id IN (
    SELECT toi.id
    FROM table_order_items toi
    WHERE toi.table_order_id IN (SELECT id FROM tmp_target_table_orders)
);

DELETE FROM table_order_items
WHERE table_order_id IN (SELECT id FROM tmp_target_table_orders);

DELETE FROM kitchen_ticket_events
WHERE kitchen_ticket_id IN (SELECT id FROM tmp_target_kitchen_tickets);

DELETE FROM kitchen_ticket_items
WHERE kitchen_ticket_id IN (SELECT id FROM tmp_target_kitchen_tickets)
   OR transaction_detail_id IN (SELECT id FROM tmp_target_transaction_details);

DELETE FROM transaction_tenant_allocation_items
WHERE transaction_tenant_allocation_id IN (SELECT id FROM tmp_target_tenant_allocations)
   OR transaction_detail_id IN (SELECT id FROM tmp_target_transaction_details);

DELETE FROM loyalty_point_histories
WHERE transaction_id IN (SELECT id FROM tmp_target_transactions);

DELETE FROM customer_campaign_logs
WHERE transaction_id IN (SELECT id FROM tmp_target_transactions)
   OR receivable_id IN (SELECT id FROM tmp_target_receivables);

DELETE FROM print_jobs
WHERE transaction_id IN (SELECT id FROM tmp_target_transactions)
   OR kitchen_ticket_id IN (SELECT id FROM tmp_target_kitchen_tickets);

DELETE FROM profits
WHERE transaction_id IN (SELECT id FROM tmp_target_transactions);

DELETE FROM cashier_shift_operators
WHERE cashier_shift_id IN (SELECT id FROM tmp_target_cashier_shifts);

-- Parent turunan
DELETE FROM kitchen_tickets
WHERE id IN (SELECT id FROM tmp_target_kitchen_tickets);

DELETE FROM transaction_tenant_allocations
WHERE id IN (SELECT id FROM tmp_target_tenant_allocations);

DELETE FROM sales_returns
WHERE id IN (SELECT id FROM tmp_target_sales_returns);

DELETE FROM receivables
WHERE id IN (SELECT id FROM tmp_target_receivables);

DELETE FROM table_orders
WHERE id IN (SELECT id FROM tmp_target_table_orders);

DELETE FROM cashier_settlement_requests
WHERE id IN (SELECT id FROM tmp_target_settlement_requests);

DELETE FROM transaction_details
WHERE id IN (SELECT id FROM tmp_target_transaction_details);

-- Jejak stock/audit terkait transaksi lama
DELETE FROM stock_mutations
WHERE
    (reference_type = 'transaction' AND reference_id IN (SELECT id FROM tmp_target_transactions))
    OR
    (reference_type = 'sales_return' AND reference_id IN (SELECT id FROM tmp_target_sales_returns));

DELETE FROM audit_logs
WHERE
    (auditable_type = 'App\\Models\\Transaction' AND auditable_id IN (SELECT id FROM tmp_target_transactions))
    OR (auditable_type = 'App\\Models\\SalesReturn' AND auditable_id IN (SELECT id FROM tmp_target_sales_returns))
    OR (auditable_type = 'App\\Models\\KitchenTicket' AND auditable_id IN (SELECT id FROM tmp_target_kitchen_tickets))
    OR (auditable_type = 'App\\Models\\TableOrder' AND auditable_id IN (SELECT id FROM tmp_target_table_orders))
    OR (auditable_type = 'App\\Models\\CashierShift' AND auditable_id IN (SELECT id FROM tmp_target_cashier_shifts))
    OR (auditable_type = 'App\\Models\\CashierSettlementRequest' AND auditable_id IN (SELECT id FROM tmp_target_settlement_requests))
    OR (JSON_EXTRACT(meta, '$.transaction_id') IN (SELECT id FROM tmp_target_transactions))
    OR (JSON_EXTRACT(meta, '$.sales_return_id') IN (SELECT id FROM tmp_target_sales_returns))
    OR (JSON_EXTRACT(meta, '$.cashier_shift_id') IN (SELECT id FROM tmp_target_cashier_shifts));

-- Parent utama
DELETE FROM transactions
WHERE id IN (SELECT id FROM tmp_target_transactions);

DELETE FROM cashier_shifts
WHERE id IN (SELECT id FROM tmp_target_cashier_shifts);

-- Rebuild agregat customer yang terdampak
UPDATE customers c
LEFT JOIN (
    SELECT
        t.customer_id,
        SUM(t.grand_total) AS total_spent,
        COUNT(*) AS transaction_count,
        MAX(t.created_at) AS last_purchase_at
    FROM transactions t
    WHERE t.customer_id IS NOT NULL
    GROUP BY t.customer_id
) tx ON tx.customer_id = c.id
LEFT JOIN (
    SELECT
        lph.customer_id,
        SUM(lph.points_delta) AS points_balance
    FROM loyalty_point_histories lph
    GROUP BY lph.customer_id
) lp ON lp.customer_id = c.id
SET
    c.loyalty_points = GREATEST(0, COALESCE(lp.points_balance, 0)),
    c.loyalty_total_spent = COALESCE(tx.total_spent, 0),
    c.loyalty_transaction_count = COALESCE(tx.transaction_count, 0),
    c.last_purchase_at = tx.last_purchase_at
WHERE c.id IN (SELECT customer_id FROM tmp_impacted_customers);

-- Rebuild metric per outlet untuk customer terdampak
DELETE FROM customer_outlet_metrics
WHERE customer_id IN (SELECT customer_id FROM tmp_impacted_customers);

INSERT INTO customer_outlet_metrics (
    customer_id,
    outlet_id,
    total_spent,
    transaction_count,
    loyalty_points_earned,
    loyalty_points_redeemed,
    loyalty_tier,
    last_purchase_at,
    created_at,
    updated_at
)
SELECT
    t.customer_id,
    t.outlet_id,
    SUM(t.grand_total) AS total_spent,
    COUNT(*) AS transaction_count,
    SUM(COALESCE(t.loyalty_points_earned, 0)) AS loyalty_points_earned,
    SUM(COALESCE(t.loyalty_points_redeemed, 0)) AS loyalty_points_redeemed,
    COALESCE(c.loyalty_tier, 'regular') AS loyalty_tier,
    MAX(t.created_at) AS last_purchase_at,
    NOW() AS created_at,
    NOW() AS updated_at
FROM transactions t
JOIN customers c ON c.id = t.customer_id
WHERE t.customer_id IN (SELECT customer_id FROM tmp_impacted_customers)
  AND t.customer_id IS NOT NULL
  AND t.outlet_id IS NOT NULL
GROUP BY t.customer_id, t.outlet_id, c.loyalty_tier;

COMMIT;

-- Ringkasan setelah cleanup
SELECT 'remaining_transactions_before_first_real_id' AS label, COUNT(*) AS total
FROM transactions
WHERE id < @first_real_transaction_id;
