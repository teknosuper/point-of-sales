import { KitchenRepository } from "../kitchen/repository";

export class TransactionsRepository {
    constructor(private readonly kitchenRepository: KitchenRepository) {}

    findStationMapping(productId: string) {
        return this.kitchenRepository.findStationMapping(productId);
    }

    findStationsByOutlet(outletId: string) {
        return this.kitchenRepository.findStationsByOutlet(outletId);
    }
}
