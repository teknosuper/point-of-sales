export type CheckoutItemInput = {
    productId: string;
    productName: string;
    quantity: number;
    notes?: string;
};

export type CheckoutInput = {
    outletId: string;
    cashierId: string;
    customerName?: string;
    items: CheckoutItemInput[];
};

export type KitchenTicketItem = {
    productId: string;
    productName: string;
    quantity: number;
    notes?: string;
};

export type KitchenTicket = {
    ticketId: string;
    transactionNumber: string;
    outletId: string;
    stationId: string;
    stationSlug: string;
    stationName: string;
    status: "pending_dispatch";
    items: KitchenTicketItem[];
};

export type CheckoutResult = {
    transactionId: string;
    transactionNumber: string;
    outletId: string;
    cashierId: string;
    customerName?: string;
    kitchenTickets: KitchenTicket[];
    unassignedItems: KitchenTicketItem[];
};
