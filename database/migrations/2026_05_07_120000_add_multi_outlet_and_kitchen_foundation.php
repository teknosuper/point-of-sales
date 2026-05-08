<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outlets', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('logo')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('outlet_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->unique(['outlet_id', 'user_id']);
            $table->index(['user_id', 'is_primary']);
        });

        Schema::create('product_outlet_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->integer('stock')->default(0);
            $table->integer('reorder_level')->default(0);
            $table->timestamp('last_counted_at')->nullable();
            $table->timestamps();

            $table->unique(['outlet_id', 'product_id']);
            $table->index(['outlet_id', 'stock']);
        });

        Schema::create('kitchen_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('code')->nullable();
            $table->string('station_type', 30)->default('kitchen');
            $table->string('display_mode', 30)->default('screen');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['outlet_id', 'slug']);
            $table->index(['outlet_id', 'is_active']);
        });

        Schema::create('kitchen_station_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_station_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('device_type', 30)->default('screen');
            $table->string('connection_driver', 30)->default('browser');
            $table->string('endpoint')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['kitchen_station_id', 'is_active']);
        });

        Schema::create('product_kitchen_station_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('kitchen_station_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('priority')->default(0);
            $table->boolean('fire_on_sale')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_id', 'kitchen_station_id'], 'product_station_unique');
        });

        Schema::create('kitchen_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cashier_shift_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('kitchen_station_id')->constrained()->cascadeOnDelete();
            $table->string('ticket_number')->unique();
            $table->string('source_channel', 30)->default('pos');
            $table->string('status', 30)->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('fired_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['outlet_id', 'status']);
            $table->index(['kitchen_station_id', 'status']);
        });

        Schema::create('kitchen_ticket_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_detail_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_title');
            $table->integer('qty');
            $table->string('status', 30)->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('fired_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('kitchen_ticket_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event');
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['kitchen_ticket_id', 'created_at']);
        });

        $this->addOutletColumn('transactions', after: 'cashier_shift_id');
        $this->addOutletColumn('transaction_details', after: 'transaction_id');
        $this->addForeignColumn('transaction_details', 'kitchen_station_id', 'kitchen_stations', 'product_id');
        $this->addOutletColumn('carts', after: 'cashier_id');
        $this->addOutletColumn('cashier_shifts', after: 'user_id');
        $this->addOutletColumn('stock_opnames', after: 'code');
        $this->addOutletColumn('stock_mutations', after: 'product_id');
        $this->addOutletColumn('sales_returns', after: 'transaction_id');
        $this->addOutletColumn('customer_credits', after: 'customer_id');
        $this->addOutletColumn('receivables', after: 'customer_id');
        $this->addOutletColumn('receivable_payments', after: 'receivable_id');
        $this->addOutletColumn('payables', after: 'supplier_id');
        $this->addOutletColumn('payable_payments', after: 'payable_id');
        $this->addOutletColumn('purchase_orders', after: 'supplier_id');
        $this->addOutletColumn('goods_receivings', after: 'purchase_order_id');
        $this->addOutletColumn('supplier_returns', after: 'supplier_id');
        $this->addOutletColumn('bank_accounts', after: 'id');
        $this->addOutletColumn('audit_logs', after: 'user_id');

        $defaultOutletId = $this->ensureDefaultOutlet();

        $this->backfillOutletMemberships($defaultOutletId);
        $this->backfillOperationalTables($defaultOutletId);
        $this->backfillProductOutletStocks($defaultOutletId);
    }

    public function down(): void
    {
        $this->dropForeignColumn('transaction_details', 'kitchen_station_id');
        $this->dropOutletColumn('audit_logs');
        $this->dropOutletColumn('bank_accounts');
        $this->dropOutletColumn('supplier_returns');
        $this->dropOutletColumn('goods_receivings');
        $this->dropOutletColumn('purchase_orders');
        $this->dropOutletColumn('payable_payments');
        $this->dropOutletColumn('payables');
        $this->dropOutletColumn('receivable_payments');
        $this->dropOutletColumn('receivables');
        $this->dropOutletColumn('customer_credits');
        $this->dropOutletColumn('sales_returns');
        $this->dropOutletColumn('stock_mutations');
        $this->dropOutletColumn('stock_opnames');
        $this->dropOutletColumn('cashier_shifts');
        $this->dropOutletColumn('carts');
        $this->dropOutletColumn('transaction_details');
        $this->dropOutletColumn('transactions');

        Schema::dropIfExists('kitchen_ticket_events');
        Schema::dropIfExists('kitchen_ticket_items');
        Schema::dropIfExists('kitchen_tickets');
        Schema::dropIfExists('product_kitchen_station_mappings');
        Schema::dropIfExists('kitchen_station_devices');
        Schema::dropIfExists('kitchen_stations');
        Schema::dropIfExists('product_outlet_stocks');
        Schema::dropIfExists('outlet_user');
        Schema::dropIfExists('outlets');
    }

    private function addOutletColumn(string $table, ?string $after = null): void
    {
        if (! Schema::hasTable($table) || Schema::hasColumn($table, 'outlet_id')) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($after) {
            $column = $blueprint->foreignId('outlet_id')->nullable()->constrained('outlets')->nullOnDelete();

            if ($after !== null) {
                $column->after($after);
            }

            $blueprint->index('outlet_id');
        });
    }

    private function addForeignColumn(string $table, string $column, string $referencesTable, ?string $after = null): void
    {
        if (! Schema::hasTable($table) || Schema::hasColumn($table, $column)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column, $referencesTable, $after) {
            $definition = $blueprint->foreignId($column)->nullable()->constrained($referencesTable)->nullOnDelete();

            if ($after !== null) {
                $definition->after($after);
            }

            $blueprint->index($column);
        });
    }

    private function dropOutletColumn(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'outlet_id')) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->dropConstrainedForeignId('outlet_id');
        });
    }

    private function dropForeignColumn(string $table, string $column): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column) {
            $blueprint->dropConstrainedForeignId($column);
        });
    }

    private function ensureDefaultOutlet(): int
    {
        $name = $this->settingValue('store_name') ?: config('app.name', 'POINZA');
        $slug = Str::slug($name ?: 'poinza-main') ?: 'poinza-main';
        $code = Str::upper(Str::limit(str_replace('-', '', $slug), 8, '')) ?: 'OUTLET01';

        $existing = DB::table('outlets')
            ->where('is_default', true)
            ->orWhere('slug', $slug)
            ->first();

        $payload = [
            'code' => $existing?->code ?: $code,
            'slug' => $existing?->slug ?: $slug,
            'name' => $name,
            'legal_name' => $name,
            'address' => $this->settingValue('store_address'),
            'city' => $this->settingValue('store_city'),
            'phone' => $this->settingValue('store_phone'),
            'email' => $this->settingValue('store_email'),
            'website' => $this->settingValue('store_website'),
            'logo' => $this->settingValue('store_logo'),
            'is_active' => true,
            'is_default' => true,
            'sort_order' => 0,
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('outlets')->where('id', $existing->id)->update($payload);

            return (int) $existing->id;
        }

        return (int) DB::table('outlets')->insertGetId([
            ...$payload,
            'created_at' => now(),
        ]);
    }

    private function backfillOutletMemberships(int $outletId): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $users = DB::table('users')->select('id')->get();

        foreach ($users as $index => $user) {
            DB::table('outlet_user')->updateOrInsert(
                [
                    'outlet_id' => $outletId,
                    'user_id' => $user->id,
                ],
                [
                    'is_primary' => $index === 0,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function backfillOperationalTables(int $outletId): void
    {
        foreach ([
            'transactions',
            'transaction_details',
            'carts',
            'cashier_shifts',
            'stock_opnames',
            'stock_mutations',
            'sales_returns',
            'customer_credits',
            'receivables',
            'receivable_payments',
            'payables',
            'payable_payments',
            'purchase_orders',
            'goods_receivings',
            'supplier_returns',
            'bank_accounts',
            'audit_logs',
        ] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'outlet_id')) {
                DB::table($table)
                    ->whereNull('outlet_id')
                    ->update(['outlet_id' => $outletId]);
            }
        }
    }

    private function backfillProductOutletStocks(int $outletId): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        $products = DB::table('products')->select('id', 'stock', 'updated_at', 'created_at')->get();

        foreach ($products as $product) {
            DB::table('product_outlet_stocks')->updateOrInsert(
                [
                    'outlet_id' => $outletId,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => (int) ($product->stock ?? 0),
                    'reorder_level' => 0,
                    'updated_at' => $product->updated_at ?? now(),
                    'created_at' => $product->created_at ?? now(),
                ]
            );
        }
    }

    private function settingValue(string $key): ?string
    {
        if (! Schema::hasTable('settings')) {
            return null;
        }

        return DB::table('settings')->where('key', $key)->value('value');
    }
};
