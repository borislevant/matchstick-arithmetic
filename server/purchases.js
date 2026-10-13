export class PurchaseStore {
  constructor(pool) { this.pool = pool; }

  async createPending({id,email,providerRef}) {
    await this.pool.query(
      `INSERT INTO purchases (id,email,unlock_code,provider_ref,status)
       VALUES ($1,$2,NULL,$3,'pending')`,
      [id,email,providerRef],
    );
  }

  async markPaid({id,email,unlockCode,providerRef}) {
    const result = await this.pool.query(
      `INSERT INTO purchases (id,email,unlock_code,provider_ref,status)
       VALUES ($1,$2,$3,$4,'paid')
       ON CONFLICT (id) DO UPDATE SET
         email=COALESCE(EXCLUDED.email,purchases.email),
         unlock_code=EXCLUDED.unlock_code,
         status='paid'
       WHERE purchases.provider_ref=EXCLUDED.provider_ref
       RETURNING id`,
      [id,email,unlockCode,providerRef],
    );
    return result.rowCount === 1;
  }

  async markFailed(providerRef) {
    await this.pool.query(
      `UPDATE purchases SET status='failed'
       WHERE provider_ref=$1 AND status='pending'`,
      [providerRef],
    );
  }

  async findPaidByUnlockCode(unlockCode) {
    const result = await this.pool.query(
      `SELECT id FROM purchases
       WHERE unlock_code=$1 AND status='paid'
       LIMIT 1`,
      [unlockCode],
    );
    return result.rows[0] || null;
  }
}
