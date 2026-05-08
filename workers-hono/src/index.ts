import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import transactionsRoutes from "./modules/transactions/routes";
import kitchenRoutes from "./modules/kitchen/routes";
import { createRequestId } from "./shared/request-id";
import type { AppVariables, Bindings } from "./shared/types";

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", async (c, next) => {
    c.set("requestId", createRequestId());
    await next();
});

app.get("/", (c) => {
    return c.json({
        name: c.env.APP_NAME ?? "POINZA",
        runtime: "cloudflare-workers",
        framework: "hono",
        status: "ok",
        message: "POINZA Workers API is ready.",
    });
});

app.get("/health", (c) => {
    return c.json({
        ok: true,
        env: c.env.APP_ENV ?? "development",
        timestamp: new Date().toISOString(),
    });
});

app.get("/api", (c) => {
    return c.json({
        service: "POINZA API",
        modules: [
            "auth",
            "products",
            "transactions",
            "kitchen",
            "customers",
            "inventory",
            "reports",
        ],
        next_step:
            "Implement route modules and Cloudflare data layer bindings.",
    });
});

app.route("/api/transactions", transactionsRoutes);
app.route("/api/kitchen", kitchenRoutes);

export default app;
