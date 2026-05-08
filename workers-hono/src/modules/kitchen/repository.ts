import type { KitchenStation, ProductStationMapping } from "./dto";

const stations: KitchenStation[] = [
    {
        id: "station-drinks",
        outletId: "outlet-main",
        slug: "minuman",
        name: "Dapur Minuman",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-noodles",
        outletId: "outlet-main",
        slug: "mie",
        name: "Dapur Mie",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-chicken",
        outletId: "outlet-main",
        slug: "ayam",
        name: "Dapur Ayam",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-ramen",
        outletId: "outlet-main",
        slug: "ramen",
        name: "Dapur Ramen",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-steak",
        outletId: "outlet-main",
        slug: "steak",
        name: "Dapur Steak",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-durian-ice",
        outletId: "outlet-main",
        slug: "es-duren",
        name: "Dapur Es Duren",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-satay",
        outletId: "outlet-main",
        slug: "sate",
        name: "Dapur Sate",
        deviceTargets: { screens: 1, printers: 1 },
    },
    {
        id: "station-salad",
        outletId: "outlet-main",
        slug: "salad",
        name: "Dapur Salad",
        deviceTargets: { screens: 1, printers: 1 },
    },
];

const mappings: ProductStationMapping[] = [
    { productId: "ayam-pedas", stationId: "station-chicken" },
    { productId: "ayam-bakar", stationId: "station-chicken" },
    { productId: "minuman-es", stationId: "station-drinks" },
    { productId: "minuman-anget", stationId: "station-drinks" },
    { productId: "salad", stationId: "station-salad" },
];

export class KitchenRepository {
    findStationsByOutlet(outletId: string): KitchenStation[] {
        return stations.filter((station) => station.outletId === outletId);
    }

    findStationBySlug(outletId: string, slug: string): KitchenStation | null {
        return (
            stations.find(
                (station) =>
                    station.outletId === outletId && station.slug === slug
            ) ?? null
        );
    }

    findStationMapping(productId: string): ProductStationMapping | null {
        return mappings.find((mapping) => mapping.productId === productId) ?? null;
    }
}
