CREATE TRIGGER update_merchant_balance_on_delivery
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status = 'READY' AND NEW.merchant_id IS NOT NULL AND NEW.merchant_total_cost IS NOT NULL THEN
        UPDATE merchants
        SET balance = balance + NEW.merchant_total_cost,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.merchant_id;

        UPDATE orders
        SET merchant_payment_status ="REVERSED",
        updated_at = CURRENT_TIMESTAMP
        where id = OLD.id;
    END IF;
END;

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


CREATE TRIGGER freeze_balance_on_payment_ready
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  DECLARE total_to_freeze DECIMAL(18,2);
  SET total_to_freeze = NEW.sent_amount + NEW.network_fees;

  IF NEW.status = 'READY' THEN
    UPDATE payment_accounts
    SET balance = balance - total_to_freeze,
        frozen_balance = frozen_balance + total_to_freeze
    WHERE id = NEW.payment_account_id;
  END IF;
END;


CREATE TRIGGER update_balance_on_payment_pending_change
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
  DECLARE total_to_freeze DECIMAL(18,2);
  SET total_to_freeze = NEW.sent_amount + NEW.network_fees;

  -- ✅ Payment succeeded → permanently remove frozen funds
  IF OLD.status = 'PENDING' AND NEW.status = 'SUCCESS' THEN
    UPDATE payment_accounts
    SET frozen_balance = frozen_balance - total_to_freeze
    WHERE id = NEW.payment_account_id;
  END IF;

  -- ❌ Payment failed → restore frozen funds to balance
  IF OLD.status = 'PENDING' AND NEW.status = 'FAILED' THEN
    UPDATE payment_accounts
    SET balance = balance + total_to_freeze,
        frozen_balance = frozen_balance - total_to_freeze
    WHERE id = NEW.payment_account_id;
  END IF;
END;

