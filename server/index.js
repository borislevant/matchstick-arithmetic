import {Pool} from 'pg';
import Stripe from 'stripe';
import {createApp} from './app.js';
import {readConfig} from './config.js';
import {PurchaseStore} from './purchases.js';

const config=readConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:config.databaseUrl,max:5,idleTimeoutMillis:30_000});
const store=new PurchaseStore(pool);
const stripe=config.stripeConfigured?new Stripe(config.stripeSecretKey):null;
const app=createApp({config,store,stripe});
const port=Number(process.env.XHOST_HTTP_PORT||process.env.PORT||3000);
const server=app.listen(port,'0.0.0.0',()=>console.log(`matchstick service listening on ${port}`));

async function shutdown(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
