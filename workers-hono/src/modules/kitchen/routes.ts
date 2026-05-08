import { Hono } from "hono";
import type { Bindings, AppVariables } from "../../shared/types";
import { KitchenRepository } from "./repository";
import { KitchenService } from "./service";
import { TransactionsRepository } from "../transactions/repository";
import { TransactionsService } from "../transactions/service";
import { validateCheckoutInput } from "../transactions/schema";

const kitchenRepository = new KitchenRepository();
const kitchenService = new KitchenService(kitchenRepository);
const transactionsRepository = new TransactionsRepository(kitchenRepository);
const transactionsService = new TransactionsService(transactionsRepository);

const kitchenRoutes = new Hono<{
    Bindings: Bindings;
    Variables: AppVariables;
}>();

kitchenRoutes.get("/stations/:outletId", (c) => {
    const outletId = c.req.param("outletId");

    return c.json({
        ok: true,
        requestId: c.get("requestId"),
        data: kitchenService.listStations(outletId),
    });
});

kitchenRoutes.post("/stations/:outletId/:stationSlug/tickets/preview", async (c) => {
    const outletId = c.req.param("outletId");
    const stationSlug = c.req.param("stationSlug");

    try {
        const payload = await c.req.json();
        const input = validateCheckoutInput({
            ...payload,
            outletId,
            cashierId:
                typeof payload?.cashierId === "string"
                    ? payload.cashierId
                    : "cashier-preview",
        });
        const result = transactionsService.checkout(input);

        return c.json({
            ok: true,
            requestId: c.get("requestId"),
            data: kitchenService.filterTicketsByStation(
                outletId,
                stationSlug,
                result.kitchenTickets
            ),
        });
    } catch (error) {
        return c.json(
            {
                ok: false,
                requestId: c.get("requestId"),
                message:
                    error instanceof Error
                        ? error.message
                        : "Preview kitchen ticket gagal diproses.",
            },
            422
        );
    }
});

export default kitchenRoutes;
