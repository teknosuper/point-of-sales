import type {
    CheckoutInput,
    CheckoutResult,
    KitchenTicket,
    KitchenTicketItem,
} from "./dto";
import { TransactionsRepository } from "./repository";

export class TransactionsService {
    constructor(private readonly repository: TransactionsRepository) {}

    checkout(input: CheckoutInput): CheckoutResult {
        const transactionId = crypto.randomUUID();
        const transactionNumber = `TRX-${Date.now()}`;
        const stations = this.repository.findStationsByOutlet(input.outletId);
        const groupedTickets = new Map<string, KitchenTicket>();
        const unassignedItems: KitchenTicketItem[] = [];

        for (const item of input.items) {
            const mapping = this.repository.findStationMapping(item.productId);

            if (!mapping) {
                unassignedItems.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    notes: item.notes,
                });
                continue;
            }

            const station = stations.find(
                (candidate) => candidate.id === mapping.stationId
            );

            if (!station) {
                unassignedItems.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    notes: item.notes,
                });
                continue;
            }

            const existingTicket = groupedTickets.get(station.id);

            if (existingTicket) {
                existingTicket.items.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    notes: item.notes,
                });
                continue;
            }

            groupedTickets.set(station.id, {
                ticketId: crypto.randomUUID(),
                transactionNumber,
                outletId: input.outletId,
                stationId: station.id,
                stationSlug: station.slug,
                stationName: station.name,
                status: "pending_dispatch",
                items: [
                    {
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        notes: item.notes,
                    },
                ],
            });
        }

        return {
            transactionId,
            transactionNumber,
            outletId: input.outletId,
            cashierId: input.cashierId,
            customerName: input.customerName,
            kitchenTickets: [...groupedTickets.values()],
            unassignedItems,
        };
    }
}
