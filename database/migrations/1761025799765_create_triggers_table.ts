import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {

  async up() {

    await this.db.rawQuery(`
        CREATE TRIGGER update_merchant_balance_on_delivery
        AFTER UPDATE ON orders
        FOR EACH ROW
        BEGIN
            IF NEW.status = 'DELIVERED' AND OLD.status = 'READY' AND NEW.merchant_id IS NOT NULL AND NEW.merchant_total_cost IS NOT NULL THEN
                UPDATE merchants
                SET balance = balance + NEW.merchant_total_cost,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.merchant_id;
            END IF;
        END;  
      `)

    await this.db.rawQuery(`
        CREATE TRIGGER update_balance_after_invoice_paid
        AFTER UPDATE ON invoices
        FOR EACH ROW
        BEGIN
          IF NEW.status = 'SUCCESS' AND OLD.status <> 'PENDING' THEN
            UPDATE payment_accounts
            SET balance = balance + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.payment_account_id;
          END IF;
        END;
  
      `)
    await this.db.rawQuery(`
        CREATE TRIGGER freeze_balance_on_payment_ready
        AFTER INSERT ON payments
        FOR EACH ROW
        BEGIN
          DECLARE total_to_freeze DECIMAL(18,2);
          SET total_to_freeze = NEW.ask_amount;

          IF NEW.status = 'CREATED' THEN

            UPDATE payment_accounts
            SET balance = balance - total_to_freeze,
                frozen_balance = frozen_balance + total_to_freeze
            WHERE id = NEW.payment_account_id;

            UPDATE merchants
            SET balance = balance - total_to_freeze,
                frozen_balance = frozen_balance + total_to_freeze
            WHERE id = NEW.merchant_id;

          END IF;
        END;
      `)

    await this.db.rawQuery(`
        CREATE TRIGGER update_balance_on_payment_pending_change
        AFTER UPDATE ON payments
        FOR EACH ROW
        BEGIN
          DECLARE total_to_freeze DECIMAL(18,2);
          SET total_to_freeze = NEW.ask_amount;

          -- ✅ Payment succeeded → permanently remove frozen funds
          IF OLD.status = 'PENDING' AND NEW.status = 'SUCCESS' THEN
            UPDATE payment_accounts
            SET frozen_balance = frozen_balance - total_to_freeze
            WHERE id = NEW.payment_account_id;

            UPDATE merchants
            SET frozen_balance = frozen_balance - total_to_freeze
            WHERE id = NEW.merchant_id;
            
          END IF;

          -- ❌ Payment failed → restore frozen funds to balance
          IF OLD.status = 'PENDING' AND NEW.status = 'FAILED' THEN
            UPDATE payment_accounts
            SET balance = balance + total_to_freeze,
                frozen_balance = frozen_balance - total_to_freeze
            WHERE id = NEW.payment_account_id;

            UPDATE merchants
            SET balance = balance + total_to_freeze,
                frozen_balance = frozen_balance - total_to_freeze
            WHERE id = NEW.merchant_id;

          END IF;
        END;  
      `)
  }

  async down() {
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS update_merchant_balance_on_delivery;
    `)
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS update_balance_after_invoice_paid;
      `)
    await this.db.rawQuery(`
       DROP TRIGGER IF EXISTS freeze_balance_on_payment_ready;
    `)
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS update_balance_on_payment_pending_change;
    `)
  }
}