import { Hono } from "hono";
import type { Bindings, AppVariables } from "../../shared/types";
import { validateCheckoutInput } from "./schema";
import { TransactionsService } from "./service";
import { TransactionsRepository } from "./repository";
import { KitchenRepository } from "../kitchen/repository";

const kitchenRepository = new KitchenRepository();
const transactionsRepository = new TransactionsRepository(kitchenRepository);
const transactionsService = new TransactionsService(transactionsRepository);

const transactionsRoutes = new Hono<{
    Bindings: Bindings;
    Variables: AppVariables;
}>();

transactionsRoutes.post("/checkout", async (c) => {
    try {
        const payload = await c.req.json();
        const input = validateCheckoutInput(payload);
        const result = transactionsService.checkout(input);

        return c.json(
            {
                ok: true,
                requestId: c.get("requestId"),
                data: result,
            },
            201
        );
    } catch (error) {
        return c.json(
            {
                ok: false,
                requestId: c.get("requestId"),
                message:
                    error instanceof Error
                        ? error.message
                        : "Checkout gagal diproses.",
            },
            422
        );
    }
});

transactionsRoutes.post("/checkout-preview", async (c) => {
    try {
        const payload = await c.req.json();
        const input = validateCheckoutInput(payload);
        const result = transactionsService.checkout(input);

        return c.json({
            ok: true,
            requestId: c.get("requestId"),
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                ok: false,
                requestId: c.get("requestId"),
                message:
                    error instanceof Error
                        ? error.message
                        : "Preview checkout gagal diproses.",
            },
            422
        );
    }
});

export default transactionsRoutes;
