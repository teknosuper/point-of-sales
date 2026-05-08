import type { KitchenTicket } from "../transactions/dto";
import { KitchenRepository } from "./repository";

export class KitchenService {
    constructor(private readonly repository: KitchenRepository) {}

    listStations(outletId: string) {
        return this.repository.findStationsByOutlet(outletId);
    }

    filterTicketsByStation(
        outletId: string,
        stationSlug: string,
        tickets: KitchenTicket[]
    ): KitchenTicket[] {
        const station = this.repository.findStationBySlug(outletId, stationSlug);

        if (!station) {
            return [];
        }

        return tickets.filter((ticket) => ticket.stationId === station.id);
    }
}
