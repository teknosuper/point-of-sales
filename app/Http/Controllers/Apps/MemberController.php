<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\Transaction;
use App\Services\CustomerOutletMetricService;
use App\Services\CustomerSegmentationService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Laravolt\Indonesia\Models\City;
use Laravolt\Indonesia\Models\District;
use Laravolt\Indonesia\Models\Province;
use Laravolt\Indonesia\Models\Village;

class MemberController extends Controller
{
    public function __construct(
        private readonly LoyaltyService $loyaltyService,
        private readonly CustomerSegmentationService $segmentationService,
        private readonly CustomerOutletMetricService $customerOutletMetricService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outletId = $this->activeOutletId($request);
        $status = $request->string('status')->value() ?: 'active';
        $search = trim((string) $request->string('search')->value());
        $tier = trim((string) $request->string('tier')->value());

        $baseQuery = Customer::query()
            ->with(['outletMetrics' => fn ($query) => $query->when($outletId, fn ($metricQuery) => $metricQuery->where('outlet_id', $outletId))])
            ->where(function ($query) {
                $query
                    ->where('is_loyalty_member', true)
                    ->orWhereNotNull('member_code');
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($customerQuery) use ($search) {
                    $customerQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('member_code', 'like', "%{$search}%");
                });
            })
            ->when($tier !== '', function ($query) use ($tier, $outletId) {
                if ($outletId) {
                    $query->whereHas('outletMetrics', fn ($metricQuery) => $metricQuery
                        ->where('outlet_id', $outletId)
                        ->where('loyalty_tier', $tier));

                    return;
                }

                $query->where('loyalty_tier', $tier);
            })
            ->when($status === 'active', function ($query) {
                $query->where('is_loyalty_member', true);
            })
            ->when($status === 'inactive', function ($query) {
                $query
                    ->where('is_loyalty_member', false)
                    ->whereNotNull('member_code');
            });

        $members = (clone $baseQuery)
            ->latest()
            ->paginate(10)
            ->through(fn (Customer $member) => $this->memberPayload($member, $outletId))
            ->withQueryString();

        $summaryQuery = Customer::query()
            ->with(['outletMetrics' => fn ($query) => $query->when($outletId, fn ($metricQuery) => $metricQuery->where('outlet_id', $outletId))])
            ->where(function ($query) {
                $query
                    ->where('is_loyalty_member', true)
                    ->orWhereNotNull('member_code');
            });

        $memberRevenue = (int) Transaction::query()
            ->whereIn('customer_id', (clone $summaryQuery)->pluck('id'))
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->sum('grand_total');

        $summaryMembers = (clone $summaryQuery)->get();
        $repeatMembers = $summaryMembers
            ->filter(fn (Customer $member) => (int) ($this->customerOutletMetricService->metricsForCustomer($member, $outletId)['transaction_count'] ?? 0) > 1)
            ->count();

        $totalMembers = $summaryMembers->count();
        $activeMembers = $summaryMembers->where('is_loyalty_member', true)->count();
        $topMember = $summaryMembers
            ->sortByDesc(fn (Customer $member) => (int) ($this->customerOutletMetricService->metricsForCustomer($member, $outletId)['total_spent'] ?? 0))
            ->first();
        $topMemberMetrics = $topMember ? $this->customerOutletMetricService->metricsForCustomer($topMember, $outletId) : null;

        return Inertia::render('Dashboard/Members/Index', [
            'members' => $members,
            'filters' => [
                'search' => $search,
                'tier' => $tier,
                'status' => $status,
            ],
            'tierOptions' => $this->loyaltyService->tierOptions(),
            'summary' => [
                'total_members' => $totalMembers,
                'active_members' => $activeMembers,
                'member_revenue' => $memberRevenue,
                'repeat_members' => $repeatMembers,
                'repeat_rate' => $totalMembers > 0 ? round(($repeatMembers / $totalMembers) * 100, 1) : 0,
                'top_member' => $topMember ? [
                    'id' => $topMember->id,
                    'name' => $topMember->name,
                    'total_spent' => (int) ($topMemberMetrics['total_spent'] ?? 0),
                ] : null,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/Members/Create', [
            'provinces' => Province::select('code', 'name')->orderBy('name')->get(),
            'tierOptions' => $this->loyaltyService->tierOptions(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateMemberRequest($request);
        $regionPayload = $this->resolveRegionPayload($validated);

        $customer = Customer::create([
            ...$this->memberPayloadFromRequest($request),
            ...$regionPayload,
            'name' => $validated['name'],
            'no_telp' => $validated['no_telp'],
            'address' => $validated['address'],
        ]);

        $this->syncOutletTierFromRequest($request, $customer);

        return to_route('members.index');
    }

    public function show(Customer $member)
    {
        $outletId = $this->activeOutletId(request());
        $member->load('segments');
        $stats = $this->buildStats($member);
        $recentTransactions = $this->recentTransactions($member, $outletId);
        $frequentProducts = $this->frequentProducts($member, $outletId);
        $rewardHistory = $member->loyaltyPointHistories()
            ->latest()
            ->limit(15)
            ->get()
            ->map(fn ($history) => [
                'id' => $history->id,
                'type' => $history->type,
                'points_delta' => (int) $history->points_delta,
                'amount_delta' => (int) $history->amount_delta,
                'balance_after' => (int) $history->balance_after,
                'reference' => $history->reference,
                'notes' => $history->notes,
                'created_at' => ReportTimezone::formatSourceDateTime($history->getRawOriginal('created_at'), 'd M Y H:i'),
            ]);
        $vouchers = $member->vouchers()
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (CustomerVoucher $voucher) => $this->loyaltyService->serializeVoucher($voucher) + [
                'is_active' => (bool) $voucher->is_active,
                'is_used' => (bool) $voucher->is_used,
            ]);

        return Inertia::render('Dashboard/Members/Show', [
            'member' => $this->memberPayload($member, $outletId),
            'segments' => $this->segmentationService->serializeCustomerSegments($member, $outletId),
            'stats' => $stats,
            'recentTransactions' => $recentTransactions,
            'frequentProducts' => $frequentProducts,
            'rewardHistory' => $rewardHistory,
            'vouchers' => $vouchers,
        ]);
    }

    public function edit(Customer $member)
    {
        return Inertia::render('Dashboard/Members/Edit', [
            'member' => $this->memberPayload($member, $this->activeOutletId(request())),
            'tierOptions' => $this->loyaltyService->tierOptions(),
            'provinces' => Province::select('code', 'name')->orderBy('name')->get(),
            'regencies' => $member->province_id
                ? City::where('province_code', $member->province_id)->select('code', 'name')->orderBy('name')->get()
                : [],
            'districts' => $member->regency_id
                ? District::where('city_code', $member->regency_id)->select('code', 'name')->orderBy('name')->get()
                : [],
            'villages' => $member->district_id
                ? Village::where('district_code', $member->district_id)->select('code', 'name')->orderBy('name')->get()
                : [],
        ]);
    }

    public function update(Request $request, Customer $member)
    {
        $validated = $this->validateMemberRequest($request, $member);
        $regionPayload = $this->resolveRegionPayload($validated);

        $member->update([
            ...$this->memberPayloadFromRequest($request, $member),
            ...$regionPayload,
            'name' => $validated['name'],
            'no_telp' => $validated['no_telp'],
            'address' => $validated['address'],
        ]);

        $this->syncOutletTierFromRequest($request, $member->fresh());

        return to_route('members.show', $member);
    }

    private function validateMemberRequest(Request $request, ?Customer $customer = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'no_telp' => ['required', 'string', Rule::unique('customers', 'no_telp')->ignore($customer?->id)],
            'address' => ['required', 'string'],
            'is_loyalty_member' => ['nullable', 'boolean'],
            'loyalty_tier' => ['nullable', 'string', Rule::in(array_keys($this->loyaltyService->tiers()))],
            'province_id' => ['required', 'string'],
            'regency_id' => ['required', 'string'],
            'district_id' => ['required', 'string'],
            'village_id' => ['required', 'string'],
        ]);
    }

    private function resolveRegionPayload(array $validated): array
    {
        $province = Province::where('code', $validated['province_id'])->first();
        $regency = City::where('code', $validated['regency_id'])->first();
        $district = District::where('code', $validated['district_id'])->first();
        $village = Village::where('code', $validated['village_id'])->first();

        return [
            'province_id' => $validated['province_id'],
            'province_name' => $province?->name,
            'regency_id' => $validated['regency_id'],
            'regency_name' => $regency?->name,
            'district_id' => $validated['district_id'],
            'district_name' => $district?->name,
            'village_id' => $validated['village_id'],
            'village_name' => $village?->name,
        ];
    }

    private function memberPayloadFromRequest(Request $request, ?Customer $customer = null): array
    {
        $isMember = $request->boolean('is_loyalty_member', true);
        $existingTier = $customer
            ? $this->loyaltyService->resolvedTier($customer, $this->activeOutletId($request))
            : LoyaltyService::TIER_REGULAR;
        $requestedTier = $request->input('loyalty_tier', $existingTier);

        if ($isMember) {
            return [
                'is_loyalty_member' => true,
                'member_code' => $customer?->member_code ?? $this->loyaltyService->issueMemberCode(),
                'loyalty_tier' => $requestedTier,
                'loyalty_member_since' => $customer?->loyalty_member_since ?? now(),
            ];
        }

        return [
            'is_loyalty_member' => false,
            'member_code' => $customer?->member_code,
            'loyalty_tier' => $customer
                ? $this->loyaltyService->resolvedTier($customer, $this->activeOutletId($request))
                : $requestedTier,
            'loyalty_member_since' => $customer?->loyalty_member_since,
        ];
    }

    private function buildStats(Customer $customer)
    {
        $outletId = $this->activeOutletId(request());

        return $this->transactionQuery($customer, $outletId)
            ->selectRaw('
                COUNT(*) as total_transactions,
                SUM(grand_total) as total_spent,
                MAX(created_at) as last_visit
            ')
            ->first();
    }

    private function recentTransactions(Customer $customer, ?int $outletId = null)
    {
        return $this->transactionQuery($customer, $outletId)
            ->select('id', 'invoice', 'grand_total', 'payment_method', 'created_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn ($transaction) => [
                'id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'total' => $transaction->grand_total,
                'payment_method' => $transaction->payment_method,
                'date' => ReportTimezone::formatSourceIso8601($transaction->getRawOriginal('created_at')),
            ]);
    }

    private function frequentProducts(Customer $customer, ?int $outletId = null)
    {
        return $this->transactionQuery($customer, $outletId)
            ->join('transaction_details', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->join('products', 'transaction_details.product_id', '=', 'products.id')
            ->selectRaw('products.id, products.title, SUM(transaction_details.qty) as total_qty')
            ->groupBy('products.id', 'products.title')
            ->orderByDesc('total_qty')
            ->limit(3)
            ->get();
    }

    private function transactionQuery(Customer $customer, ?int $outletId = null)
    {
        return Transaction::query()
            ->where('customer_id', $customer->id)
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));
    }

    private function activeOutletId(Request $request): ?int
    {
        return $this->outletResolver->resolve($request)?->id;
    }

    private function memberPayload(Customer $member, ?int $outletId = null): array
    {
        $metrics = $this->customerOutletMetricService->metricsForCustomer($member, $outletId);

        return [
            ...$member->toArray(),
            'loyalty_tier' => (string) ($metrics['loyalty_tier'] ?? $member->loyalty_tier ?? LoyaltyService::TIER_REGULAR),
            'loyalty_total_spent' => (int) ($metrics['total_spent'] ?? 0),
            'loyalty_transaction_count' => (int) ($metrics['transaction_count'] ?? 0),
            'last_purchase_at' => ReportTimezone::formatSourceIso8601($metrics['last_purchase_at'] ?? null),
        ];
    }

    private function syncOutletTierFromRequest(Request $request, ?Customer $customer): void
    {
        if (! $customer || ! $request->boolean('is_loyalty_member', true)) {
            return;
        }

        $outletId = $this->activeOutletId($request);

        if (! $outletId) {
            return;
        }

        $this->customerOutletMetricService->setTier(
            $customer,
            $outletId,
            (string) $request->input('loyalty_tier', $customer->loyalty_tier ?: LoyaltyService::TIER_REGULAR)
        );
    }
}
