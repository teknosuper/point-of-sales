<?php

namespace Database\Seeders;

use App\Models\NotificationSound;
use Illuminate\Database\Seeder;

class NotificationSoundSeeder extends Seeder
{
    public function run(): void
    {
        $sounds = [
            [
                'name' => 'Notifikasi Default',
                'type' => NotificationSound::TYPE_GENERAL,
                'file_path' => 'notification-sounds/notifikasi.mp3',
                'original_name' => 'notifikasi.mp3',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Pesanan Baru',
                'type' => NotificationSound::TYPE_NEW_ORDER,
                'file_path' => 'notification-sounds/pesananbaru.mp3',
                'original_name' => 'pesananbaru.mp3',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Error Alert',
                'type' => NotificationSound::TYPE_ERROR,
                'file_path' => 'notification-sounds/error.mp3',
                'original_name' => 'error.mp3',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Pengingat',
                'type' => NotificationSound::TYPE_REMINDER,
                'file_path' => 'notification-sounds/reminder.mp3',
                'original_name' => 'reminder.mp3',
                'is_active' => true,
                'sort_order' => 1,
            ],
        ];

        foreach ($sounds as $sound) {
            NotificationSound::updateOrCreate(
                ['file_path' => $sound['file_path']],
                $sound
            );
        }
    }
}
