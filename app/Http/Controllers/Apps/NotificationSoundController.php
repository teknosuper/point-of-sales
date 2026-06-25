<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\NotificationSound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class NotificationSoundController extends Controller
{
    /**
     * Render the notification sounds settings page
     */
    public function index(Request $request)
    {
        return Inertia::render('Dashboard/Settings/NotificationSounds');
    }

    /**
     * API: Get all sounds (for React component)
     */
    public function data(Request $request): JsonResponse
    {
        $type = $request->input('type');
        
        $query = NotificationSound::query()
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy('type')
            ->orderBy('sort_order')
            ->orderBy('name');

        $sounds = $query->get()->map(fn ($sound) => [
            'id' => $sound->id,
            'name' => $sound->name,
            'type' => $sound->type,
            'type_label' => NotificationSound::getTypes()[$sound->type] ?? $sound->type,
            'url' => $sound->url,
            'file_path' => $sound->file_path,
            'original_name' => $sound->original_name,
            'file_size' => $sound->file_size,
            'file_size_human' => $sound->file_size_human,
            'is_active' => $sound->is_active,
            'sort_order' => $sound->sort_order,
            'created_at' => $sound->created_at->toISOString(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $sounds,
            'types' => NotificationSound::getTypes(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::in(array_keys(NotificationSound::getTypes()))],
            'file' => ['required', 'file', 'mimes:mp3,wav,ogg,webm', 'max:5120'], // max 5MB
            'replace_existing' => ['sometimes', 'boolean'],
        ]);

        $file = $request->file('file');
        $fileName = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $filePath = 'notification-sounds/' . $fileName;
        
        // Store the file
        Storage::disk('public')->putFileAs('notification-sounds', $file, $fileName);

        // Check if there's an existing active sound of the same type - delete it
        $replaceExisting = $request->boolean('replace_existing', true);
        if ($replaceExisting) {
            $existingSound = NotificationSound::where('type', $validated['type'])->where('is_active', true)->first();
            if ($existingSound) {
                // Delete old file
                if (Storage::disk('public')->exists($existingSound->file_path)) {
                    Storage::disk('public')->delete($existingSound->file_path);
                }
                $existingSound->delete();
            }
        }

        $sound = NotificationSound::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'file_path' => $filePath,
            'original_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'is_active' => true,
            'sort_order' => 0,
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Suara notifikasi berhasil diupload.',
            ]);
        }

        return redirect()->back()->with('success', 'Suara notifikasi berhasil diupload.');
    }

    public function update(Request $request, NotificationSound $sound): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'type' => ['sometimes', Rule::in(array_keys(NotificationSound::getTypes()))],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $sound->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Suara notifikasi berhasil diperbarui.',
            'data' => [
                'id' => $sound->id,
                'name' => $sound->name,
                'type' => $sound->type,
                'type_label' => NotificationSound::getTypes()[$sound->type],
                'url' => $sound->url,
                'is_active' => $sound->is_active,
                'sort_order' => $sound->sort_order,
            ],
        ]);
    }

    public function setActive(Request $request, NotificationSound $sound): JsonResponse
    {
        // First, deactivate all sounds of the same type
        NotificationSound::where('type', $sound->type)
            ->where('id', '!=', $sound->id)
            ->update(['is_active' => false]);

        // Then activate the selected sound
        $sound->update(['is_active' => true]);

        return response()->json([
            'success' => true,
            'message' => "Suara '{$sound->name}' sekarang aktif untuk tipe {$sound->type}.",
            'data' => [
                'id' => $sound->id,
                'name' => $sound->name,
                'type' => $sound->type,
                'is_active' => true,
            ],
        ]);
    }

    public function destroy(NotificationSound $sound): JsonResponse
    {
        // Delete the file
        if (Storage::disk('public')->exists($sound->file_path)) {
            Storage::disk('public')->delete($sound->file_path);
        }

        $sound->delete();

        return response()->json([
            'success' => true,
            'message' => 'Suara notifikasi berhasil dihapus.',
        ]);
    }

    public function play(NotificationSound $sound): JsonResponse
    {
        // Just return the URL for the frontend to play
        return response()->json([
            'success' => true,
            'data' => [
                'url' => $sound->url,
                'name' => $sound->name,
            ],
        ]);
    }
}
