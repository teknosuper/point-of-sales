<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Outlet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CategoryController extends Controller
{
    private const IMAGE_DIRECTORY = 'public/categories';
    private const DEFAULT_IMAGE = 'default.jpg';

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'tenant_outlet_id' => $request->input('tenant_outlet_id', ''),
            'has_image' => $request->input('has_image', ''),
            'sort' => $request->input('sort', 'latest'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $categories = Category::query()
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
                'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']),
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        return Inertia::render('Dashboard/Categories/Create', [
            'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
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
            $image->storeAs(self::IMAGE_DIRECTORY, $image->hashName());
            $imageName = $image->hashName();
        }

        Category::create([
            'image' => $imageName,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
        ]);

        return to_route('categories.index');
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit(Category $category)
    {
        return Inertia::render('Dashboard/Categories/Edit', [
            'category' => $category,
            'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']),
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
            $image->storeAs(self::IMAGE_DIRECTORY, $image->hashName());

            $category->update([
                'image' => $image->hashName(),
                'name' => $validated['name'],
                'description' => $validated['description'],
                'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
            ]);
        } else {
            $category->update([
                'name' => $validated['name'],
                'description' => $validated['description'],
                'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
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
    public function destroy($id)
    {
        $category = Category::findOrFail($id);
        $this->deleteCategoryImage($category->getRawOriginal('image'));
        $category->delete();
        return to_route('categories.index');
    }

    private function deleteCategoryImage(?string $image): void
    {
        if (blank($image)) {
            return;
        }

        $filename = basename($image);

        Storage::disk('local')->delete([
            'public/category/'.$filename,
            'public/categories/'.$filename,
        ]);
    }
}
