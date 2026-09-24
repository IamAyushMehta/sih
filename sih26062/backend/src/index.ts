import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env';
import { healthRouter } from './routes/health';
import { dbRouter } from './routes/db';
import { initDbIfNeeded } from './db/init';
import { authRouter } from './routes/auth';
import { planningRouter } from './routes/planning';
import { shippingRouter } from './routes/shipping';
import { inventoryRouter } from './routes/inventory';
import { readRouter } from './routes/read';


declare const require: any;

const _ = require; // no-op to satisfy TS when shims exist
import { demoRouter } from './routes/demo';


const app = express();

function dotenvConfigGuard() {
  // env.ts already calls dotenv.config(); this guard prevents accidental removal.
  // Intentionally empty.
}

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/db', dbRouter);
app.use('/auth', authRouter);
app.use('/planning', planningRouter);
app.use('/shipping', shippingRouter);
// Read-only convenience endpoints for UI pages
app.use('/', readRouter);
app.use('/inventory', inventoryRouter);
app.use('/demo', demoRouter);

async function main() {
  if (env.DB_INIT_ON_START) {
    await initDbIfNeeded();
  }

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Backend failed to start', err);
  process.exit(1);
});
