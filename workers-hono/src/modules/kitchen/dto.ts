export type KitchenStation = {
    id: string;
    outletId: string;
    slug: string;
    name: string;
    deviceTargets: {
        screens: number;
        printers: number;
    };
};

export type ProductStationMapping = {
    productId: string;
    stationId: string;
};
