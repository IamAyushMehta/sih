"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const health_1 = require("./routes/health");
const db_1 = require("./routes/db");
const init_1 = require("./db/init");
const auth_1 = require("./routes/auth");
const planning_1 = require("./routes/planning");
const shipping_1 = require("./routes/shipping");
const inventory_1 = require("./routes/inventory");
const read_1 = require("./routes/read");
const _ = require; // no-op to satisfy TS when shims exist
const demo_1 = require("./routes/demo");
const app = (0, express_1.default)();
function dotenvConfigGuard() {
    // env.ts already calls dotenv.config(); this guard prevents accidental removal.
    // Intentionally empty.
}
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use('/health', health_1.healthRouter);
app.use('/db', db_1.dbRouter);
app.use('/auth', auth_1.authRouter);
app.use('/planning', planning_1.planningRouter);
app.use('/shipping', shipping_1.shippingRouter);
// Read-only convenience endpoints for UI pages
app.use('/', read_1.readRouter);
app.use('/inventory', inventory_1.inventoryRouter);
app.use('/demo', demo_1.demoRouter);
async function main() {
    if (env_1.env.DB_INIT_ON_START) {
        await (0, init_1.initDbIfNeeded)();
    }
    app.listen(env_1.env.PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Backend listening on http://localhost:${env_1.env.PORT}`);
    });
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Backend failed to start', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map