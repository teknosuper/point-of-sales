<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\PaymentSetting;
use App\Services\AuditLogService;
use App\Services\ImageUploadService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PaymentSettingController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly ImageUploadService $imageUploadService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function edit(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $setting = PaymentSetting::firstOrCreateForOutlet($outletId, [
            'default_gateway' => 'cash',
        ]);
        $pakasirSupported = PaymentSetting::supportsPakasirConfiguration();

        $qrisImageUrl = null;
        if ($setting->qris_static_image) {
            $qrisImageUrl = $this->resolveImageUrl($setting->qris_static_image);
        }

        $midtransWebhookUrl = route('webhooks.midtrans');
        $xenditWebhookUrl = route('webhooks.xendit');
        $appUrl = (string) config('app.url');
        $webhookWarnings = [];

        if (blank($appUrl)) {
            $webhookWarnings[] = 'APP_URL belum diatur. Webhook URL yang dihasilkan bisa tidak valid untuk Midtrans/Xendit.';
        } elseif ($this->isLocalAppUrl($appUrl)) {
            $webhookWarnings[] = 'APP_URL masih mengarah ke localhost atau 127.0.0.1. Payment gateway membutuhkan URL publik yang bisa diakses dari internet.';
        }

        if ($setting->xendit_enabled && ! $setting->secretConfigured('xendit_callback_token')) {
            $webhookWarnings[] = 'Xendit aktif tetapi callback token belum diisi. Webhook Xendit akan ditolak sampai token tersedia.';
        }

        if (! $pakasirSupported) {
            $webhookWarnings[] = 'Kolom konfigurasi Pakasir belum tersedia di database. Jalankan migration terbaru sebelum mengaktifkan Pakasir.';
        }

        if (collect($setting->paymentSettingSources())->contains(fn (array $source) => $source['source'] === 'env')) {
            $this->auditLogService->log(
                event: 'security.payment_secret_source_overridden',
                module: 'security',
                auditable: $setting,
                description: 'Konfigurasi payment memakai env override untuk secret sensitif.',
                meta: [
                    'severity' => 'info',
                    'sources' => collect($setting->paymentSettingSources())
                        ->filter(fn (array $source) => $source['source'] === 'env')
                        ->keys()
                        ->values()
                        ->all(),
                ],
            );
        }

        return Inertia::render('Dashboard/Settings/Payment', [
            'setting' => [
                'default_gateway' => $setting->default_gateway,
                'bank_transfer_enabled' => (bool) $setting->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $setting->midtrans_enabled,
                'midtrans_client_key' => $setting->midtrans_client_key,
                'midtrans_production' => (bool) $setting->midtrans_production,
                'xendit_enabled' => (bool) $setting->xendit_enabled,
                'xendit_public_key' => $setting->xendit_public_key,
                'xendit_production' => (bool) $setting->xendit_production,
                'pakasir_enabled' => $pakasirSupported ? (bool) $setting->pakasir_enabled : false,
                'pakasir_project_slug' => $pakasirSupported ? $setting->pakasir_project_slug : null,
                'pakasir_method' => $pakasirSupported ? ($setting->pakasir_method ?: 'qris') : 'qris',
                'pakasir_fee_percentage' => $pakasirSupported ? (float) ($setting->pakasir_fee_percentage ?? 0) : 0,
                'pakasir_fee_fixed' => $pakasirSupported ? (int) ($setting->pakasir_fee_fixed ?? 0) : 0,
                'qris_enabled' => (bool) $setting->qris_enabled,
                'qris_static_image' => $qrisImageUrl,
            ],
            'paymentSettingSources' => $setting->paymentSettingSources(),
            'supportedGateways' => array_values(array_filter([
                ['value' => 'cash', 'label' => 'Tunai'],
                ['value' => PaymentSetting::GATEWAY_BANK_TRANSFER, 'label' => 'Transfer Bank'],
                ['value' => PaymentSetting::GATEWAY_MIDTRANS, 'label' => 'Midtrans'],
                ['value' => PaymentSetting::GATEWAY_XENDIT, 'label' => 'Xendit'],
                $pakasirSupported ? ['value' => PaymentSetting::GATEWAY_PAKASIR, 'label' => 'Pakasir'] : null,
                ['value' => PaymentSetting::GATEWAY_QRIS, 'label' => 'QRIS'],
            ])),
            'webhookUrls' => [
                'midtrans' => $midtransWebhookUrl,
                'xendit' => $xenditWebhookUrl,
                'pakasir' => $pakasirSupported ? route('webhooks.pakasir') : null,
            ],
            'webhookWarnings' => $webhookWarnings,
            'pakasirSupported' => $pakasirSupported,
        ]);
    }

    public function update(Request $request)
    {
        if (! PaymentSetting::supportsPakasirConfiguration()) {
            return back()->withErrors([
                'pakasir_enabled' => 'Migration Pakasir belum dijalankan. Jalankan php artisan migrate terlebih dahulu.',
            ])->withInput();
        }

        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $setting = PaymentSetting::firstOrCreateForOutlet($outletId, [
            'default_gateway' => 'cash',
        ]);
        $beforeState = $setting->replicate();

        $data = $request->validate([
            'default_gateway' => [
                'required',
                Rule::in(['cash', PaymentSetting::GATEWAY_BANK_TRANSFER, PaymentSetting::GATEWAY_MIDTRANS, PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_PAKASIR, PaymentSetting::GATEWAY_QRIS]),
            ],
            'bank_transfer_enabled' => ['boolean'],
            'midtrans_enabled' => ['boolean'],
            'midtrans_server_key' => ['nullable', 'string'],
            'midtrans_client_key' => ['nullable', 'string'],
            'midtrans_production' => ['boolean'],
            'xendit_enabled' => ['boolean'],
            'xendit_secret_key' => ['nullable', 'string'],
            'xendit_public_key' => ['nullable', 'string'],
            'xendit_callback_token' => ['nullable', 'string', 'max:255'],
            'xendit_production' => ['boolean'],
            'pakasir_enabled' => ['boolean'],
            'pakasir_project_slug' => ['nullable', 'string', 'max:255'],
            'pakasir_api_key' => ['nullable', 'string'],
            'pakasir_method' => ['nullable', Rule::in([
                'cimb_niaga_va',
                'bni_va',
                'qris',
                'sampoerna_va',
                'bnc_va',
                'maybank_va',
                'permata_va',
                'atm_bersama_va',
                'artha_graha_va',
                'bri_va',
            ])],
            'pakasir_fee_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pakasir_fee_fixed' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'qris_enabled' => ['boolean'],
            'qris_static_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg', 'max:2048'],
            'remove_qris_image' => ['nullable', 'boolean'],
        ]);

        $midtransEnabled = (bool) ($data['midtrans_enabled'] ?? false);
        $xenditEnabled = (bool) ($data['xendit_enabled'] ?? false);
        $pakasirEnabled = (bool) ($data['pakasir_enabled'] ?? false);
        $qrisEnabled = (bool) ($data['qris_enabled'] ?? false);
        $resolvedMidtransServerKey = $setting->secretManagedByEnvironment('midtrans_server_key')
            ? $setting->resolvedSecret('midtrans_server_key')
            : ($data['midtrans_server_key'] ?: $setting->getAttributeValue('midtrans_server_key'));
        $resolvedXenditSecretKey = $setting->secretManagedByEnvironment('xendit_secret_key')
            ? $setting->resolvedSecret('xendit_secret_key')
            : ($data['xendit_secret_key'] ?: $setting->getAttributeValue('xendit_secret_key'));
        $resolvedXenditCallbackToken = $setting->secretManagedByEnvironment('xendit_callback_token')
            ? $setting->resolvedSecret('xendit_callback_token')
            : ($data['xendit_callback_token'] ?: $setting->getAttributeValue('xendit_callback_token'));
        $resolvedPakasirApiKey = $setting->secretManagedByEnvironment('pakasir_api_key')
            ? $setting->resolvedSecret('pakasir_api_key')
            : ($data['pakasir_api_key'] ?: $setting->getAttributeValue('pakasir_api_key'));

        if ($midtransEnabled && (blank($resolvedMidtransServerKey) || empty($data['midtrans_client_key']))) {
            return back()->withErrors([
                'midtrans_server_key' => 'Server key dan Client key Midtrans wajib diisi saat mengaktifkan Midtrans.',
            ])->withInput();
        }

        if ($xenditEnabled && blank($resolvedXenditSecretKey)) {
            return back()->withErrors([
                'xendit_secret_key' => 'Secret key Xendit wajib diisi saat mengaktifkan Xendit.',
            ])->withInput();
        }

        if ($xenditEnabled && blank($resolvedXenditCallbackToken)) {
            return back()->withErrors([
                'xendit_callback_token' => 'Callback token Xendit wajib diisi saat mengaktifkan Xendit.',
            ])->withInput();
        }

        if ($pakasirEnabled && blank($data['pakasir_project_slug'] ?? null)) {
            return back()->withErrors([
                'pakasir_project_slug' => 'Project slug Pakasir wajib diisi saat mengaktifkan Pakasir.',
            ])->withInput();
        }

        if ($pakasirEnabled && blank($resolvedPakasirApiKey)) {
            return back()->withErrors([
                'pakasir_api_key' => 'API key Pakasir wajib diisi saat mengaktifkan Pakasir.',
            ])->withInput();
        }

        if (
            $data['default_gateway'] !== 'cash'
            && ! (
                ($data['default_gateway'] === PaymentSetting::GATEWAY_MIDTRANS && $midtransEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_XENDIT && $xenditEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_PAKASIR && $pakasirEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_BANK_TRANSFER && (bool) ($data['bank_transfer_enabled'] ?? false))
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_QRIS && $qrisEnabled)
            )
        ) {
            return back()->withErrors([
                'default_gateway' => 'Gateway default harus dalam kondisi aktif.',
            ])->withInput();
        }

        // Handle QRIS image
        $qrisImage = $setting->getRawOriginal('qris_static_image') ?? $setting->qris_static_image;
        if ($request->boolean('remove_qris_image')) {
            if ($qrisImage) {
                $this->imageUploadService->deletePublicImage($qrisImage, ['qris']);
            }
            $qrisImage = null;
        } elseif ($request->file('qris_static_image')) {
            if ($qrisImage) {
                $this->imageUploadService->deletePublicImage($qrisImage, ['qris']);
            }
            $qrisImage = $this->imageUploadService->storePublicImage(
                $request->file('qris_static_image'),
                'qris',
                [
                    'max_width' => 1200,
                    'max_height' => 1200,
                    'thumb_width' => 480,
                    'thumb_height' => 480,
                ]
            )['path'];
        }

        $setting->update([
            'default_gateway' => $data['default_gateway'],
            'bank_transfer_enabled' => (bool) ($data['bank_transfer_enabled'] ?? false),
            'midtrans_enabled' => $midtransEnabled,
            'midtrans_server_key' => $setting->secretManagedByEnvironment('midtrans_server_key')
                ? $setting->getRawOriginal('midtrans_server_key')
                : ($data['midtrans_server_key'] ?: $setting->getAttributeValue('midtrans_server_key')),
            'midtrans_client_key' => $data['midtrans_client_key'],
            'midtrans_production' => (bool) ($data['midtrans_production'] ?? false),
            'xendit_enabled' => $xenditEnabled,
            'xendit_secret_key' => $setting->secretManagedByEnvironment('xendit_secret_key')
                ? $setting->getRawOriginal('xendit_secret_key')
                : ($data['xendit_secret_key'] ?: $setting->getAttributeValue('xendit_secret_key')),
            'xendit_public_key' => $data['xendit_public_key'],
            'xendit_callback_token' => $setting->secretManagedByEnvironment('xendit_callback_token')
                ? $setting->getRawOriginal('xendit_callback_token')
                : ($data['xendit_callback_token'] ?: $setting->getAttributeValue('xendit_callback_token')),
            'xendit_production' => (bool) ($data['xendit_production'] ?? false),
            'pakasir_enabled' => $pakasirEnabled,
            'pakasir_project_slug' => $data['pakasir_project_slug'],
            'pakasir_api_key' => $setting->secretManagedByEnvironment('pakasir_api_key')
                ? $setting->getRawOriginal('pakasir_api_key')
                : ($data['pakasir_api_key'] ?: $setting->getAttributeValue('pakasir_api_key')),
            'pakasir_method' => $data['pakasir_method'] ?: 'qris',
            'pakasir_fee_percentage' => (float) ($data['pakasir_fee_percentage'] ?? 0),
            'pakasir_fee_fixed' => (int) ($data['pakasir_fee_fixed'] ?? 0),
            'qris_enabled' => $qrisEnabled,
            'qris_static_image' => $qrisImage,
        ]);

        $this->auditLogService->log(
            event: 'payment.setting.updated',
            module: 'payment_settings',
            auditable: $setting,
            description: 'Konfigurasi payment gateway diperbarui.',
            before: [
                'default_gateway' => $beforeState->default_gateway,
                'bank_transfer_enabled' => (bool) $beforeState->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $beforeState->midtrans_enabled,
                'midtrans_production' => (bool) $beforeState->midtrans_production,
                'xendit_enabled' => (bool) $beforeState->xendit_enabled,
                'xendit_production' => (bool) $beforeState->xendit_production,
                'pakasir_enabled' => (bool) $beforeState->pakasir_enabled,
                'qris_enabled' => (bool) ($beforeState->qris_enabled ?? false),
                'midtrans_server_key' => filled($beforeState->midtrans_server_key) ? 'configured' : 'empty',
                'midtrans_client_key' => filled($beforeState->midtrans_client_key) ? 'configured' : 'empty',
                'xendit_secret_key' => filled($beforeState->xendit_secret_key) ? 'configured' : 'empty',
                'xendit_public_key' => filled($beforeState->xendit_public_key) ? 'configured' : 'empty',
                'xendit_callback_token' => filled($beforeState->xendit_callback_token) ? 'configured' : 'empty',
                'pakasir_project_slug' => $beforeState->pakasir_project_slug,
                'pakasir_method' => $beforeState->pakasir_method,
                'pakasir_fee_percentage' => (float) ($beforeState->pakasir_fee_percentage ?? 0),
                'pakasir_fee_fixed' => (int) ($beforeState->pakasir_fee_fixed ?? 0),
                'pakasir_api_key' => filled($beforeState->pakasir_api_key) ? 'configured' : 'empty',
            ],
            after: [
                'default_gateway' => $setting->default_gateway,
                'bank_transfer_enabled' => (bool) $setting->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $setting->midtrans_enabled,
                'midtrans_production' => (bool) $setting->midtrans_production,
                'xendit_enabled' => (bool) $setting->xendit_enabled,
                'xendit_production' => (bool) $setting->xendit_production,
                'pakasir_enabled' => (bool) $setting->pakasir_enabled,
                'qris_enabled' => (bool) $setting->qris_enabled,
                'midtrans_server_key' => $this->auditLogService->credentialState($beforeState->midtrans_server_key, $setting->midtrans_server_key),
                'midtrans_client_key' => $this->auditLogService->credentialState($beforeState->midtrans_client_key, $setting->midtrans_client_key),
                'xendit_secret_key' => $this->auditLogService->credentialState($beforeState->xendit_secret_key, $setting->xendit_secret_key),
                'xendit_public_key' => $this->auditLogService->credentialState($beforeState->xendit_public_key, $setting->xendit_public_key),
                'xendit_callback_token' => $this->auditLogService->credentialState($beforeState->xendit_callback_token, $setting->xendit_callback_token),
                'pakasir_project_slug' => $setting->pakasir_project_slug,
                'pakasir_method' => $setting->pakasir_method,
                'pakasir_fee_percentage' => (float) ($setting->pakasir_fee_percentage ?? 0),
                'pakasir_fee_fixed' => (int) ($setting->pakasir_fee_fixed ?? 0),
                'pakasir_api_key' => $this->auditLogService->credentialState($beforeState->pakasir_api_key, $setting->pakasir_api_key),
            ],
        );

        if (collect($setting->paymentSettingSources())->contains(fn (array $source) => $source['source'] === 'env')) {
            $this->auditLogService->log(
                event: 'security.payment_secret_source_overridden',
                module: 'security',
                auditable: $setting,
                description: 'Perubahan payment settings tetap tunduk pada env override untuk secret sensitif.',
                meta: [
                    'severity' => 'info',
                    'sources' => collect($setting->paymentSettingSources())
                        ->filter(fn (array $source) => $source['source'] === 'env')
                        ->keys()
                        ->values()
                        ->all(),
                ],
            );
        }

        return redirect()
            ->route('settings.payments.edit')
            ->with('success', 'Konfigurasi payment gateway berhasil disimpan.');
    }

    private function resolveImageUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/storage/']) || Str::startsWith($path, 'data:')) {
            return $path;
        }

        return '/storage/'.ltrim($path, '/');
    }

    private function normalizeStoragePath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $path = ltrim($path, '/');
        if (Str::startsWith($path, 'storage/')) {
            return substr($path, 8);
        }

        return $path;
    }

    private function isLocalAppUrl(string $appUrl): bool
    {
        $host = parse_url($appUrl, PHP_URL_HOST);

        return in_array($host, ['localhost', '127.0.0.1'], true)
            || str_ends_with((string) $host, '.test');
    }
}
