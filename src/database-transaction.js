import { dbManager } from './database.js';
import { logger } from './logger.js';

export class DatabaseTransaction {
  constructor() {}

  /**
   * Execute a function within a database transaction.
   * Handles automatic rollback on error.
   * @param {Function} fn - The function to execute within the transaction.
   * @returns {*} - The result of the function.
   */
  execute(fn) {
    if (!dbManager.isAvailable()) {
      throw new Error('Database not available for transaction');
    }

    try {
      // better-sqlite3 transactions are synchronous and handle rollback automatically if an error is thrown
      const txn = dbManager.db.transaction((...args) => {
        return fn(...args);
      });
      
      return txn();
    } catch (e) {
      logger.error(`Transaction failed and rolled back: ${e.message}`);
      throw e;
    }
  }

  async validateIntegrity() {
    if (!dbManager.isAvailable()) return false;
    
    try {
      const result = dbManager.db.pragma('integrity_check');
      return result === 'ok';
    } catch (e) {
      return false;
    }
  }
}

export const dbTransaction = new DatabaseTransaction();
export default dbTransaction;
