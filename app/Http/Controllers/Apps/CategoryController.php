<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Outlet;
use App\Services\ImageUploadService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CategoryController extends Controller
{
    private const IMAGE_DIRECTORY = 'public/categories';
    private const DEFAULT_IMAGE = 'default.jpg';

    public function __construct(
        private readonly ImageUploadService $imageUploadService,
        private readonly OutletResolver $outletResolver
    ) {}

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $activeOutlet?->outlet_type === 'tenant';

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'tenant_outlet_id' => $isTenantWorkspace
                ? (string) ($activeOutlet?->id ?? '')
                : $request->input('tenant_outlet_id', ''),
            'has_image' => $request->input('has_image', ''),
            'sort' => $request->input('sort', 'latest'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $categories = Category::query()
            ->when(
                $isTenantWorkspace && $activeOutlet?->id,
                fn ($query) => $query->where('tenant_outlet_id', $activeOutlet->id)
            )
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];

                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('description', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['tenant_outlet_id'] !== '', function ($query) use ($filters) {
                if ($filters['tenant_outlet_id'] === 'global') {
                    return $query->whereNull('tenant_outlet_id');
                }

                return $query->where('tenant_outlet_id', $filters['tenant_outlet_id']);
            })
            ->when($filters['has_image'] !== '', function ($query) use ($filters) {
                if ($filters['has_image'] === 'yes') {
                    $query->whereNotNull('image')->where('image', '!=', '');
                }

                if ($filters['has_image'] === 'no') {
                    $query->where(function ($innerQuery) {
                        $innerQuery->whereNull('image')->orWhere('image', '');
                    });
                }
            });

        $categories = match ($filters['sort']) {
            'name_asc' => $categories->orderBy('name'),
            'name_desc' => $categories->orderByDesc('name'),
            'oldest' => $categories->oldest(),
            default => $categories->latest(),
        };

        $categories = $categories
            ->with('tenantOutlet:id,name,code')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('Dashboard/Categories/Index', [
            'categories' => $categories,
            'filters' => $filters,
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'tenantOutlets' => $this->availableTenantOutlets($request),
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());

        return Inertia::render('Dashboard/Categories/Create', [
            'tenantOutlets' => $this->availableTenantOutlets($request),
            'workspace' => [
                'is_tenant' => $activeOutlet?->outlet_type === 'tenant',
                'active_outlet_id' => $activeOutlet?->id,
            ],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $activeOutlet?->outlet_type === 'tenant';

        /**
         * validate
         */
        $validated = $request->validate([
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'tenant_outlet_id' => ['nullable', 'exists:outlets,id'],
        ], [
            'image.image' => 'File yang diunggah harus berupa gambar.',
            'image.mimes' => 'Format gambar harus jpeg, jpg, png, atau webp.',
            'image.max' => 'Ukuran gambar maksimal 2MB.',
            'name.required' => 'Nama kategori wajib diisi.',
            'description.required' => 'Deskripsi kategori wajib diisi.',
        ]);

        $image = $request->file('image');
        $imageName = self::DEFAULT_IMAGE;

        if ($image) {
            $storedImage = $this->imageUploadService->storePublicImage(
                $image,
                'categories',
                [
                    'max_width' => 1440,
                    'max_height' => 960,
                    'thumb_width' => 480,
                    'thumb_height' => 320,
                ]
            );
            $imageName = $storedImage['basename'];
        }

        Category::create([
            'image' => $imageName,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'tenant_outlet_id' => $isTenantWorkspace
                ? ($activeOutlet?->id ?: null)
                : ($request->integer('tenant_outlet_id') ?: null),
        ]);

        return to_route('categories.index');
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit(Request $request, Category $category)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $activeOutlet?->outlet_type === 'tenant';

        if ($isTenantWorkspace && (int) ($category->tenant_outlet_id ?? 0) !== (int) ($activeOutlet?->id ?? 0)) {
            abort(403, 'Tenant hanya dapat mengelola kategori tenant aktif.');
        }

        return Inertia::render('Dashboard/Categories/Edit', [
            'category' => $category,
            'tenantOutlets' => $this->availableTenantOutlets($request),
            'workspace' => [
                'is_tenant' => $isTenantWorkspace,
                'active_outlet_id' => $activeOutlet?->id,
            ],
        ]);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Category $category)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $activeOutlet?->outlet_type === 'tenant';

        if ($isTenantWorkspace && (int) ($category->tenant_outlet_id ?? 0) !== (int) ($activeOutlet?->id ?? 0)) {
            abort(403, 'Tenant hanya dapat mengelola kategori tenant aktif.');
        }

        $validated = $request->validate([
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'tenant_outlet_id' => ['nullable', 'exists:outlets,id'],
        ], [
            'image.image' => 'File yang diunggah harus berupa gambar.',
            'image.mimes' => 'Format gambar harus jpeg, jpg, png, atau webp.',
            'image.max' => 'Ukuran gambar maksimal 2MB.',
            'name.required' => 'Nama kategori wajib diisi.',
            'description.required' => 'Deskripsi kategori wajib diisi.',
        ]);

        if ($request->file('image')) {
            $this->deleteCategoryImage($category->getRawOriginal('image'));
            $image = $request->file('image');
            $storedImage = $this->imageUploadService->storePublicImage(
                $image,
                'categories',
                [
                    'max_width' => 1440,
                    'max_height' => 960,
                    'thumb_width' => 480,
                    'thumb_height' => 320,
                ]
            );

            $category->update([
                'image' => $storedImage['basename'],
                'name' => $validated['name'],
                'description' => $validated['description'],
                'tenant_outlet_id' => $isTenantWorkspace
                    ? ($activeOutlet?->id ?: null)
                    : ($request->integer('tenant_outlet_id') ?: null),
            ]);
        } else {
            $category->update([
                'name' => $validated['name'],
                'description' => $validated['description'],
                'tenant_outlet_id' => $isTenantWorkspace
                    ? ($activeOutlet?->id ?: null)
                    : ($request->integer('tenant_outlet_id') ?: null),
            ]);
        }

        return to_route('categories.index');
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy(Request $request, $id)
    {
        $category = Category::findOrFail($id);
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());

        if ($activeOutlet?->outlet_type === 'tenant' && (int) ($category->tenant_outlet_id ?? 0) !== (int) ($activeOutlet?->id ?? 0)) {
            abort(403, 'Tenant hanya dapat menghapus kategori tenant aktif.');
        }

        $this->deleteCategoryImage($category->getRawOriginal('image'));
        $category->delete();
        return to_route('categories.index');
    }

    private function availableTenantOutlets(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());

        if ($activeOutlet?->outlet_type === 'tenant') {
            return collect([$activeOutlet])
                ->map(fn (Outlet $outlet) => $outlet->only(['id', 'name', 'code', 'outlet_type']))
                ->values();
        }

        return $request->user()?->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->ordered()
            ->get(['outlets.id', 'outlets.name', 'outlets.code', 'outlets.outlet_type'])
            ?? collect();
    }

    private function deleteCategoryImage(?string $image): void
    {
        if (blank($image)) {
            return;
        }

        $this->imageUploadService->deletePublicImage($image, ['category', 'categories']);
    }
}
