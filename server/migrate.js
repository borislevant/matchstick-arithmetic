import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

const connectionString=process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for migrations');
const pool=new Pool({connectionString,max:1});
try {
  const sql=await readFile(new URL('./migrations/001_purchases.sql',import.meta.url),'utf8');
  await pool.query(sql);
  console.log('database migration complete');
} finally { await pool.end(); }
