<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Menambah indexes untuk mengurangi lock contention pada transaksi POS.
     */
    public function up(): void
    {
        // stock_mutations - sering di-query berdasarkan product_id + outlet_id
        if (Schema::hasTable('stock_mutations')) {
            Schema::table('stock_mutations', function (Blueprint $table) {
                // Composite index untuk query stock per outlet
                if (! $this->indexExists($table, 'stock_mutations_product_outlet_idx')) {
                    $table->index(['product_id', 'outlet_id', 'created_at'], 'stock_mutations_product_outlet_idx');
                }
                
                // Index untuk reference lookup
                if (! $this->indexExists($table, 'stock_mutations_reference_idx')) {
                    $table->index(['reference_type', 'reference_id'], 'stock_mutations_reference_idx');
                }
                
                // Index untuk outlet-based queries
                if (! $this->indexExists($table, 'stock_mutations_outlet_created_idx')) {
                    $table->index(['outlet_id', 'created_at'], 'stock_mutations_outlet_created_idx');
                }
            });
        }

        // audit_logs - sering di-query untuk filtering dan sorting
        if (Schema::hasTable('audit_logs')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                // Composite index untuk auditable polymorphic queries
                if (! $this->indexExists($table, 'audit_logs_auditable_idx')) {
                    $table->index(['auditable_type', 'auditable_id', 'created_at'], 'audit_logs_auditable_idx');
                }
                
                // Index untuk user-based queries
                if (! $this->indexExists($table, 'audit_logs_user_created_idx')) {
                    $table->index(['user_id', 'created_at'], 'audit_logs_user_created_idx');
                }
                
                // Index untuk outlet-based queries
                if (! $this->indexExists($table, 'audit_logs_outlet_created_idx')) {
                    $table->index(['outlet_id', 'created_at'], 'audit_logs_outlet_created_idx');
                }
                
                // Index untuk event filtering
                if (! $this->indexExists($table, 'audit_logs_event_module_idx')) {
                    $table->index(['event', 'module', 'created_at'], 'audit_logs_event_module_idx');
                }
            });
        }

        // transaction_profits - sering di-query berdasarkan transaction_id
        if (Schema::hasTable('transaction_profits')) {
            Schema::table('transaction_profits', function (Blueprint $table) {
                if (! $this->indexExists($table, 'transaction_profits_transaction_idx')) {
                    $table->index('transaction_id', 'transaction_profits_transaction_idx');
                }
            });
        }

        // transaction_modifiers - sering di-query berdasarkan transaction_detail_id
        if (Schema::hasTable('transaction_modifiers')) {
            Schema::table('transaction_modifiers', function (Blueprint $table) {
                if (! $this->indexExists($table, 'transaction_modifiers_detail_idx')) {
                    $table->index('transaction_detail_id', 'transaction_modifiers_detail_idx');
                }
            });
        }

        // kitchen_ticket_items - sering di-query berdasarkan kitchen_ticket_id
        if (Schema::hasTable('kitchen_ticket_items')) {
            Schema::table('kitchen_ticket_items', function (Blueprint $table) {
                if (! $this->indexExists($table, 'kitchen_ticket_items_ticket_idx')) {
                    $table->index('kitchen_ticket_id', 'kitchen_ticket_items_ticket_idx');
                }
                
                if (! $this->indexExists($table, 'kitchen_ticket_items_detail_idx')) {
                    $table->index('transaction_detail_id', 'kitchen_ticket_items_detail_idx');
                }
            });
        }

        // transaction_tenant_allocations - sering di-query berdasarkan transaction_id
        if (Schema::hasTable('transaction_tenant_allocations')) {
            Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
                if (! $this->indexExists($table, 'tenant_allocations_transaction_idx')) {
                    $table->index('transaction_id', 'tenant_allocations_transaction_idx');
                }
                
                if (! $this->indexExists($table, 'tenant_allocations_tenant_idx')) {
                    $table->index(['tenant_outlet_id', 'transaction_id'], 'tenant_allocations_tenant_idx');
                }
            });
        }

        // transaction_tenant_allocation_items - sering di-query berdasarkan allocation_id
        if (Schema::hasTable('transaction_tenant_allocation_items')) {
            Schema::table('transaction_tenant_allocation_items', function (Blueprint $table) {
                if (! $this->indexExists($table, 'tenant_allocation_items_allocation_idx')) {
                    $table->index('transaction_tenant_allocation_id', 'tenant_allocation_items_allocation_idx');
                }
                
                if (! $this->indexExists($table, 'tenant_allocation_items_detail_idx')) {
                    $table->index('transaction_detail_id', 'tenant_allocation_items_detail_idx');
                }
            });
        }

        // loyalty_point_histories - sering di-query berdasarkan customer_id + transaction_id
        if (Schema::hasTable('loyalty_point_histories')) {
            Schema::table('loyalty_point_histories', function (Blueprint $table) {
                if (! $this->indexExists($table, 'loyalty_histories_customer_idx')) {
                    $table->index(['customer_id', 'created_at'], 'loyalty_histories_customer_idx');
                }
                
                if (! $this->indexExists($table, 'loyalty_histories_transaction_idx')) {
                    $table->index('transaction_id', 'loyalty_histories_transaction_idx');
                }
            });
        }

        // customer_outlet_metrics - sering di-query berdasarkan customer_id + outlet_id
        if (Schema::hasTable('customer_outlet_metrics')) {
            Schema::table('customer_outlet_metrics', function (Blueprint $table) {
                if (! $this->indexExists($table, 'customer_outlet_metrics_customer_outlet_idx')) {
                    $table->unique(['customer_id', 'outlet_id'], 'customer_outlet_metrics_customer_outlet_idx');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('stock_mutations')) {
            Schema::table('stock_mutations', function (Blueprint $table) {
                $this->safeDropIndex($table, 'stock_mutations_product_outlet_idx');
                $this->safeDropIndex($table, 'stock_mutations_reference_idx');
                $this->safeDropIndex($table, 'stock_mutations_outlet_created_idx');
            });
        }

        if (Schema::hasTable('audit_logs')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $this->safeDropIndex($table, 'audit_logs_auditable_idx');
                $this->safeDropIndex($table, 'audit_logs_user_created_idx');
                $this->safeDropIndex($table, 'audit_logs_outlet_created_idx');
                $this->safeDropIndex($table, 'audit_logs_event_module_idx');
            });
        }

        if (Schema::hasTable('transaction_profits')) {
            Schema::table('transaction_profits', function (Blueprint $table) {
                $this->safeDropIndex($table, 'transaction_profits_transaction_idx');
            });
        }

        if (Schema::hasTable('transaction_modifiers')) {
            Schema::table('transaction_modifiers', function (Blueprint $table) {
                $this->safeDropIndex($table, 'transaction_modifiers_detail_idx');
            });
        }

        if (Schema::hasTable('kitchen_ticket_items')) {
            Schema::table('kitchen_ticket_items', function (Blueprint $table) {
                $this->safeDropIndex($table, 'kitchen_ticket_items_ticket_idx');
                $this->safeDropIndex($table, 'kitchen_ticket_items_detail_idx');
            });
        }

        if (Schema::hasTable('transaction_tenant_allocations')) {
            Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
                $this->safeDropIndex($table, 'tenant_allocations_transaction_idx');
                $this->safeDropIndex($table, 'tenant_allocations_tenant_idx');
            });
        }

        if (Schema::hasTable('transaction_tenant_allocation_items')) {
            Schema::table('transaction_tenant_allocation_items', function (Blueprint $table) {
                $this->safeDropIndex($table, 'tenant_allocation_items_allocation_idx');
                $this->safeDropIndex($table, 'tenant_allocation_items_detail_idx');
            });
        }

        if (Schema::hasTable('loyalty_point_histories')) {
            Schema::table('loyalty_point_histories', function (Blueprint $table) {
                $this->safeDropIndex($table, 'loyalty_histories_customer_idx');
                $this->safeDropIndex($table, 'loyalty_histories_transaction_idx');
            });
        }

        if (Schema::hasTable('customer_outlet_metrics')) {
            Schema::table('customer_outlet_metrics', function (Blueprint $table) {
                $this->safeDropIndex($table, 'customer_outlet_metrics_customer_outlet_idx');
            });
        }
    }

    /**
     * Check if index exists
     */
    private function indexExists(Blueprint $table, string $indexName): bool
    {
        try {
            $tableName = $table->getTable();
            $sm = Schema::getConnection()->getDoctrineSchemaManager();
            $indexes = $sm->listTableIndexes($tableName);
            return isset($indexes[$indexName]);
        } catch (\Exception $e) {
            // If we can't check, assume it doesn't exist
            return false;
        }
    }

    /**
     * Safely drop index if exists
     */
    private function safeDropIndex(Blueprint $table, string $indexName): void
    {
        try {
            if ($this->indexExists($table, $indexName)) {
                $table->dropIndex($indexName);
            }
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
    }
};
