"""Protocol terms (spec section 6). Pool-level terms live in credent.core.pool."""

CREDIT_ADVANCE_BPS = 4000  # credit limit = 40% of the proven 90-day revenue threshold
LOAN_APR_BPS = 1800
LOAN_EPOCHS = 12
EPOCH_DAYS = 7
HISTORY_DAYS = 90
THRESHOLD_STEP = 10_000_00  # suggested thresholds are rounded down to $10k
FAUCET_AMOUNT = 250_000_00
