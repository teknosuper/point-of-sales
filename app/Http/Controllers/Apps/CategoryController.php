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
            ->with(['tenantOutlet:id,name,code', 'parent:id,name'])
            ->paginate($filters['per_page'])
            ->withQueryString();

        $treeQuery = Category::query()
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];

                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('description', 'like', '%'.$search.'%');
                });
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
            })
            ->with(['tenantOutlet:id,name,code', 'parent:id,name']);

        if ($isTenantWorkspace && $activeOutlet?->id) {
            $treeQuery->where('tenant_outlet_id', $activeOutlet->id);
        } elseif ($filters['tenant_outlet_id'] !== '') {
            if ($filters['tenant_outlet_id'] === 'global') {
                $treeQuery->whereNull('tenant_outlet_id');
            } else {
                $treeQuery->where('tenant_outlet_id', $filters['tenant_outlet_id']);
            }
        }

        $allCategories = $treeQuery->orderBy('parent_id')->orderBy('name')->get();

        $parentIds = $allCategories
            ->pluck('parent_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (! empty($parentIds)) {
            $missingParents = Category::query()
                ->whereIn('id', $parentIds)
                ->with(['tenantOutlet:id,name,code', 'parent:id,name'])
                ->get();

            $existingIds = $allCategories->pluck('id')->toArray();
            $missingParents = $missingParents->filter(
                fn ($cat) => ! in_array($cat->id, $existingIds, true)
            );

            $allCategories = $allCategories->merge($missingParents)->values();
        }

        return Inertia::render('Dashboard/Categories/Index', [
            'categories' => $categories,
            'allCategories' => $allCategories,
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
            'mainCategories' => Category::query()
                ->whereNull('parent_id')
                ->whereNull('tenant_outlet_id')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->values(),
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
            'parent_id' => ['nullable', 'exists:categories,id'],
        ], [
            'image.image' => 'File yang diunggah harus berupa gambar.',
            'image.mimes' => 'Format gambar harus jpeg, jpg, png, atau webp.',
            'image.max' => 'Ukuran gambar maksimal 2MB.',
            'name.required' => 'Nama kategori wajib diisi.',
            'description.required' => 'Deskripsi kategori wajib diisi.',
            'parent_id.exists' => 'Kategori utama tidak valid.',
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

        $tenantOutletId = $isTenantWorkspace
            ? ($activeOutlet?->id ?: null)
            : ($request->integer('tenant_outlet_id') ?: null);

        $parentId = $request->integer('parent_id') ?: null;

        // Tenant categories must have a parent main category
        if ($tenantOutletId && ! $parentId) {
            $mainCategory = Category::query()
                ->whereNull('parent_id')
                ->whereNull('tenant_outlet_id')
                ->where('name', $validated['name'])
                ->first();

            if ($mainCategory) {
                $parentId = $mainCategory->id;
            }
        }

        Category::create([
            'image' => $imageName,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'tenant_outlet_id' => $tenantOutletId,
            'parent_id' => $parentId,
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
            'mainCategories' => Category::query()
                ->whereNull('parent_id')
                ->whereNull('tenant_outlet_id')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->values(),
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
            'parent_id' => ['nullable', 'exists:categories,id'],
        ], [
            'image.image' => 'File yang diunggah harus berupa gambar.',
            'image.mimes' => 'Format gambar harus jpeg, jpg, png, atau webp.',
            'image.max' => 'Ukuran gambar maksimal 2MB.',
            'name.required' => 'Nama kategori wajib diisi.',
            'description.required' => 'Deskripsi kategori wajib diisi.',
            'parent_id.exists' => 'Kategori utama tidak valid.',
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
                'parent_id' => $request->integer('parent_id') ?: null,
            ]);
        } else {
            $category->update([
                'name' => $validated['name'],
                'description' => $validated['description'],
                'tenant_outlet_id' => $isTenantWorkspace
                    ? ($activeOutlet?->id ?: null)
                    : ($request->integer('tenant_outlet_id') ?: null),
                'parent_id' => $request->integer('parent_id') ?: null,
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

    public function bulkMove(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $activeOutlet?->outlet_type === 'tenant';

        $validated = $request->validate([
            'category_ids' => ['required', 'array', 'min:1'],
            'category_ids.*' => ['required', 'exists:categories,id'],
            'parent_id' => ['nullable', 'exists:categories,id'],
        ], [
            'category_ids.required' => 'Pilih minimal satu kategori yang akan dipindah.',
            'category_ids.min' => 'Pilih minimal satu kategori yang akan dipindah.',
            'parent_id.exists' => 'Kategori utama tujuan tidak valid.',
        ]);

        $categoryIds = $validated['category_ids'];
        $parentId = $validated['parent_id'] ?: null;

        if ($isTenantWorkspace && $activeOutlet?->id) {
            $forbidden = Category::whereIn('id', $categoryIds)
                ->where('tenant_outlet_id', '!=', $activeOutlet->id)
                ->whereNotNull('tenant_outlet_id')
                ->exists();

            if ($forbidden) {
                abort(403, 'Tenant hanya dapat memindahkan kategori milik outlet aktif.');
            }
        }

        if ($parentId) {
            $parent = Category::findOrFail($parentId);
            if ((bool) $parent->tenant_outlet_id) {
                return back()->with('error', 'Kategori utama tujuan tidak boleh menjadi kategori tenant.');
            }
        }

        Category::whereIn('id', $categoryIds)->update(['parent_id' => $parentId]);

        return back()->with('success', count($categoryIds).' kategori berhasil dipindahkan.');
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
