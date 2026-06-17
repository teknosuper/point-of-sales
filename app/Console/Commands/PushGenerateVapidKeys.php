<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

class PushGenerateVapidKeys extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'push:generate-vapid';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate VAPID keys for native web push notifications';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $keys = VAPID::createVapidKeys();

        $this->info('Tambahkan env berikut ke file .env Anda:');
        $this->newLine();
        $this->line('WEB_PUSH_VAPID_SUBJECT=mailto:admin@gtc-center.my.id');
        $this->line('WEB_PUSH_VAPID_PUBLIC_KEY='.$keys['publicKey']);
        $this->line('WEB_PUSH_VAPID_PRIVATE_KEY='.$keys['privateKey']);

        return self::SUCCESS;
    }
}
