<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class PaymentSetting extends Model
{
    use BelongsToOutlet, HasFactory;

    public const GATEWAY_MIDTRANS = 'midtrans';

    public const GATEWAY_XENDIT = 'xendit';

    public const GATEWAY_BANK_TRANSFER = 'bank_transfer';

    public const SECRET_FIELDS = [
        'midtrans_server_key',
        'xendit_secret_key',
        'xendit_callback_token',
    ];

    protected $fillable = [
        'outlet_id',
        'default_gateway',
        'bank_transfer_enabled',
        'midtrans_enabled',
        'midtrans_server_key',
        'midtrans_client_key',
        'midtrans_production',
        'xendit_enabled',
        'xendit_secret_key',
        'xendit_public_key',
        'xendit_callback_token',
        'xendit_production',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'bank_transfer_enabled' => 'boolean',
        'midtrans_enabled' => 'boolean',
        'midtrans_production' => 'boolean',
        'xendit_enabled' => 'boolean',
        'xendit_production' => 'boolean',
        'midtrans_server_key' => 'encrypted',
        'xendit_secret_key' => 'encrypted',
        'xendit_callback_token' => 'encrypted',
    ];

    public static function resolveForOutlet(?int $outletId = null): ?self
    {
        $query = static::query();

        if (! static::usesOutletScope()) {
            return $query->first();
        }

        if ($outletId !== null) {
            return $query
                ->where(function ($builder) use ($outletId) {
                    $builder->where('outlet_id', $outletId)->orWhereNull('outlet_id');
                })
                ->orderByRaw('CASE WHEN outlet_id = ? THEN 0 ELSE 1 END', [$outletId])
                ->first();
        }

        return $query->whereNull('outlet_id')->first();
    }

    public static function firstOrCreateForOutlet(?int $outletId = null, array $defaults = []): self
    {
        if (! static::usesOutletScope() || $outletId === null) {
            return static::firstOrCreate([], $defaults);
        }

        $existing = static::query()->where('outlet_id', $outletId)->first();
        if ($existing) {
            return $existing;
        }

        $fallback = static::resolveForOutlet($outletId);
        $payload = [
            'outlet_id' => $outletId,
            ...$defaults,
        ];

        if ($fallback) {
            $fallbackAttributes = collect($fallback->getFillable())
                ->reject(fn ($field) => in_array($field, ['outlet_id'], true))
                ->mapWithKeys(fn ($field) => [$field => $fallback->getAttributeValue($field)])
                ->all();

            $payload = [
                'outlet_id' => $outletId,
                ...$fallbackAttributes,
                ...$defaults,
            ];
        }

        return static::create($payload);
    }

    public function enabledGateways(?int $outletId = null): array
    {
        $gateways = [];

        // Bank Transfer
        if ($this->isBankTransferReady($outletId)) {
            $gateways[] = [
                'value' => self::GATEWAY_BANK_TRANSFER,
                'label' => 'Transfer Bank',
                'description' => 'Pembayaran manual via transfer bank.',
            ];
        }

        if ($this->isGatewayReady(self::GATEWAY_MIDTRANS)) {
            $gateways[] = [
                'value' => self::GATEWAY_MIDTRANS,
                'label' => 'Midtrans',
                'description' => 'Bagikan tautan pembayaran Snap Midtrans ke pelanggan.',
            ];
        }

        if ($this->isGatewayReady(self::GATEWAY_XENDIT)) {
            $gateways[] = [
                'value' => self::GATEWAY_XENDIT,
                'label' => 'Xendit',
                'description' => 'Buat invoice otomatis menggunakan Xendit.',
            ];
        }

        return $gateways;
    }

    /**
     * Check if bank transfer is ready (enabled and has active bank accounts)
     */
    public function isBankTransferReady(?int $outletId = null): bool
    {
        return $this->bank_transfer_enabled
            && BankAccount::active()
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
                ->exists();
    }

    public function isGatewayReady(string $gateway, ?int $outletId = null): bool
    {
        return match ($gateway) {
            self::GATEWAY_BANK_TRANSFER => $this->isBankTransferReady($outletId),
            self::GATEWAY_MIDTRANS => $this->midtrans_enabled
            && filled($this->resolvedSecret('midtrans_server_key'))
            && filled($this->midtrans_client_key),
            self::GATEWAY_XENDIT => $this->xendit_enabled
            && filled($this->resolvedSecret('xendit_secret_key'))
            && filled($this->xendit_public_key),
            default => false,
        };
    }

    public function midtransConfig(): array
    {
        return [
            'enabled' => $this->isGatewayReady(self::GATEWAY_MIDTRANS),
            'server_key' => $this->resolvedSecret('midtrans_server_key'),
            'client_key' => $this->midtrans_client_key,
            'is_production' => $this->midtrans_production,
        ];
    }

    public function xenditConfig(): array
    {
        return [
            'enabled' => $this->isGatewayReady(self::GATEWAY_XENDIT),
            'secret_key' => $this->resolvedSecret('xendit_secret_key'),
            'public_key' => $this->xendit_public_key,
            'callback_token' => $this->resolvedSecret('xendit_callback_token'),
            'is_production' => $this->xendit_production,
        ];
    }

    public function resolvedSecret(string $field): ?string
    {
        $envValue = $this->envSecretValue($field);

        if (filled($envValue)) {
            return $envValue;
        }

        return $this->getAttributeValue($field);
    }

    public function secretSource(string $field): string
    {
        if (filled($this->envSecretValue($field))) {
            return 'env';
        }

        if (filled($this->getAttributeValue($field))) {
            return 'database';
        }

        return 'none';
    }

    public function secretConfigured(string $field): bool
    {
        return filled($this->resolvedSecret($field));
    }

    public function secretManagedByEnvironment(string $field): bool
    {
        return $this->secretSource($field) === 'env';
    }

    public function maskedSecret(string $field): ?string
    {
        $value = $this->resolvedSecret($field);

        if (blank($value)) {
            return null;
        }

        $length = strlen($value);

        if ($length <= 4) {
            return str_repeat('•', $length);
        }

        return str_repeat('•', max($length - 4, 4)).substr($value, -4);
    }

    public function paymentSettingSources(): array
    {
        return [
            'midtrans_server_key' => $this->secretMetadata('midtrans_server_key'),
            'xendit_secret_key' => $this->secretMetadata('xendit_secret_key'),
            'xendit_callback_token' => $this->secretMetadata('xendit_callback_token'),
        ];
    }

    private function secretMetadata(string $field): array
    {
        return [
            'source' => $this->secretSource($field),
            'configured' => $this->secretConfigured($field),
            'managed_by_environment' => $this->secretManagedByEnvironment($field),
            'masked' => $this->maskedSecret($field),
        ];
    }

    private function envSecretValue(string $field): ?string
    {
        return match ($field) {
            'midtrans_server_key' => config('services.midtrans.server_key'),
            'xendit_secret_key' => config('services.xendit.secret_key'),
            'xendit_callback_token' => config('services.xendit.callback_token'),
            default => null,
        };
    }

    private static function usesOutletScope(): bool
    {
        return Schema::hasColumn('payment_settings', 'outlet_id');
    }
}
