<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageUploadService
{
    public function storePublicImage(UploadedFile $file, string $directory, array $options = []): array
    {
        $disk = Storage::disk('public');
        $directory = trim($directory, '/');
        $quality = (int) ($options['quality'] ?? 82);
        $maxWidth = (int) ($options['max_width'] ?? 1600);
        $maxHeight = (int) ($options['max_height'] ?? 1600);
        $createThumb = (bool) ($options['create_thumb'] ?? true);
        $thumbWidth = (int) ($options['thumb_width'] ?? 480);
        $thumbHeight = (int) ($options['thumb_height'] ?? 480);
        $stem = Str::uuid()->toString();
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: '');

        if ($extension === 'svg' || $file->getMimeType() === 'image/svg+xml') {
            $path = $file->storeAs($directory, $stem.'.svg', 'public');

            return [
                'path' => $path,
                'basename' => basename($path),
                'thumb_path' => null,
                'thumb_basename' => null,
            ];
        }

        if (! function_exists('imagecreatetruecolor') || ! function_exists('imagewebp')) {
            $path = $file->storeAs($directory, $stem.'.'.$extension, 'public');

            return [
                'path' => $path,
                'basename' => basename($path),
                'thumb_path' => null,
                'thumb_basename' => null,
            ];
        }

        $source = $this->createImageResource($file);
        if (! $source) {
            $path = $file->storeAs($directory, $stem.'.'.$extension, 'public');

            return [
                'path' => $path,
                'basename' => basename($path),
                'thumb_path' => null,
                'thumb_basename' => null,
            ];
        }

        $path = $directory.'/'.$stem.'.webp';
        $optimized = $this->resizeImage($source, $maxWidth, $maxHeight);
        $disk->put($path, $this->encodeWebp($optimized, $quality));
        imagedestroy($optimized);

        $thumbPath = null;
        if ($createThumb) {
            $thumbPath = $directory.'/thumbs/'.$stem.'.webp';
            $thumb = $this->resizeImage($source, $thumbWidth, $thumbHeight);
            $disk->put($thumbPath, $this->encodeWebp($thumb, max(70, min(quality, 80))));
            imagedestroy($thumb);
        }

        imagedestroy($source);

        return [
            'path' => $path,
            'basename' => basename($path),
            'thumb_path' => $thumbPath,
            'thumb_basename' => $thumbPath ? basename($thumbPath) : null,
        ];
    }

    public function deletePublicImage(?string $value, array $directories = []): void
    {
        if (blank($value)) {
            return;
        }

        $disk = Storage::disk('public');
        $normalized = $this->normalizePublicPath($value);
        $candidates = [];

        if ($normalized !== null) {
            $candidates[] = $normalized;
            $candidates[] = $this->thumbPathFor($normalized);
        }

        $basename = basename((string) $value);
        $stem = pathinfo($basename, PATHINFO_FILENAME);
        $extension = pathinfo($basename, PATHINFO_EXTENSION);

        foreach ($directories as $directory) {
            $directory = trim((string) $directory, '/');
            if ($directory === '') {
                continue;
            }

            if ($extension !== '') {
                $candidates[] = $directory.'/'.$basename;
                $candidates[] = $directory.'/thumbs/'.$basename;
            }

            foreach (['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg'] as $candidateExtension) {
                $candidates[] = $directory.'/'.$stem.'.'.$candidateExtension;
                $candidates[] = $directory.'/thumbs/'.$stem.'.'.$candidateExtension;
            }
        }

        $disk->delete(array_values(array_unique(array_filter($candidates))));
    }

    private function normalizePublicPath(?string $value): ?string
    {
        if (! is_string($value) || blank($value)) {
            return null;
        }

        $normalized = trim($value);

        if (Str::startsWith($normalized, ['/storage/', 'storage/'])) {
            return ltrim(Str::replaceFirst('/storage/', '', $normalized), '/');
        }

        if (Str::startsWith($normalized, ['http://', 'https://'])) {
            $path = parse_url($normalized, PHP_URL_PATH);

            if (! is_string($path) || ! Str::startsWith($path, '/storage/')) {
                return null;
            }

            return ltrim(Str::replaceFirst('/storage/', '', $path), '/');
        }

        return ltrim($normalized, '/');
    }

    private function thumbPathFor(string $path): string
    {
        $directory = trim(pathinfo($path, PATHINFO_DIRNAME), '.');
        $basename = basename($path);

        if ($directory === '' || $directory === '/') {
            return 'thumbs/'.$basename;
        }

        if (str_contains($directory, '/thumbs')) {
            return $path;
        }

        return trim($directory, '/').'/thumbs/'.$basename;
    }

    private function createImageResource(UploadedFile $file)
    {
        $mime = strtolower((string) $file->getMimeType());
        $realPath = $file->getRealPath();

        if (! $realPath) {
            return null;
        }

        return match ($mime) {
            'image/jpeg', 'image/jpg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($realPath) : null,
            'image/png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($realPath) : null,
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($realPath) : null,
            'image/gif' => function_exists('imagecreatefromgif') ? @imagecreatefromgif($realPath) : null,
            default => null,
        };
    }

    private function resizeImage($source, int $maxWidth, int $maxHeight)
    {
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);

        if ($sourceWidth <= 0 || $sourceHeight <= 0) {
            return $source;
        }

        $ratio = min(
            1,
            $maxWidth > 0 ? $maxWidth / $sourceWidth : 1,
            $maxHeight > 0 ? $maxHeight / $sourceHeight : 1
        );

        $targetWidth = max(1, (int) round($sourceWidth * $ratio));
        $targetHeight = max(1, (int) round($sourceHeight * $ratio));

        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        imagealphablending($canvas, true);
        imagesavealpha($canvas, true);

        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
        imagefill($canvas, 0, 0, $transparent);
        imagecopyresampled(
            $canvas,
            $source,
            0,
            0,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $sourceWidth,
            $sourceHeight
        );

        return $canvas;
    }

    private function encodeWebp($image, int $quality): string
    {
        ob_start();
        imagewebp($image, null, max(50, min($quality, 90)));

        return (string) ob_get_clean();
    }
}
