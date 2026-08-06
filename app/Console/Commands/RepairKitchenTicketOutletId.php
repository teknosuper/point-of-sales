<?php

namespace App\Console\Commands;

use App\Models\KitchenStation;
use App\Models\KitchenTicket;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairKitchenTicketOutletId extends Command
{
    protected $signature = 'kitchen:repair-ticket-outlet-id
                            {--dry-run : Show what would be updated without making changes}
                            {--station= : Only repair tickets for a specific station slug}';

    protected $description = 'Fix kitchen tickets where outlet_id does not match their kitchen station outlet_id (foodcourt multi-tenant mismatch)';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $stationSlug = $this->option('station');

        $this->info($dryRun ? '[DRY RUN] Scanning kitchen tickets with outlet_id mismatch...' : 'Repairing kitchen tickets with outlet_id mismatch...');

        // Build query: tickets whose outlet_id != their station's outlet_id
        $query = KitchenTicket::query()
            ->join('kitchen_stations', 'kitchen_stations.id', '=', 'kitchen_tickets.kitchen_station_id')
            ->whereColumn('kitchen_tickets.outlet_id', '!=', 'kitchen_stations.outlet_id')
            ->select(
                'kitchen_tickets.id',
                'kitchen_tickets.outlet_id as ticket_outlet_id',
                'kitchen_tickets.kitchen_station_id',
                'kitchen_tickets.ticket_number',
                'kitchen_tickets.status',
                'kitchen_stations.outlet_id as station_outlet_id',
                'kitchen_stations.slug as station_slug',
            );

        if ($stationSlug) {
            $query->where('kitchen_stations.slug', $stationSlug);
        }

        $tickets = $query->get();

        if ($tickets->isEmpty()) {
            $this->info('No mismatched tickets found.');
            return self::SUCCESS;
        }

        $this->info("Found {$tickets->count()} ticket(s) with mismatched outlet_id:");
        $this->table(
            ['Ticket ID', 'Ticket #', 'Status', 'Station', 'Ticket outlet_id', 'Station outlet_id'],
            $tickets->map(fn ($t) => [
                $t->id,
                $t->ticket_number,
                $t->status,
                $t->station_slug,
                $t->ticket_outlet_id,
                $t->station_outlet_id,
            ])->toArray()
        );

        if ($dryRun) {
            $this->warn('Dry run — no changes made. Remove --dry-run to apply.');
            return self::SUCCESS;
        }

        if (! $this->confirm("Update {$tickets->count()} ticket(s)? This is irreversible.")) {
            $this->info('Aborted.');
            return self::SUCCESS;
        }

        $updated = 0;

        DB::transaction(function () use ($tickets, &$updated) {
            foreach ($tickets as $ticket) {
                KitchenTicket::where('id', $ticket->id)
                    ->update(['outlet_id' => $ticket->station_outlet_id]);
                $updated++;
            }
        });

        $this->info("Updated {$updated} ticket(s) successfully.");

        return self::SUCCESS;
    }
}
