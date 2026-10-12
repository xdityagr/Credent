"""Domain errors. Each carries a stable `code` and an HTTP status for the API layer."""


class DomainError(Exception):
    code = "DOMAIN_ERROR"
    status = 400

    def __init__(self, message: str | None = None):
        super().__init__(message or self.__class__.__doc__ or self.code)
        self.message = str(self.args[0])


class InvalidAmount(DomainError):
    """Amount must be a positive number of cents."""
    code = "INVALID_AMOUNT"


class SubordinationBreach(DomainError):
    """Senior capital may not exceed 4x junior capital."""
    code = "SUBORDINATION_BREACH"
    status = 409


class InsufficientLiquidity(DomainError):
    """The pool does not have enough idle cash for this drawdown."""
    code = "INSUFFICIENT_LIQUIDITY"
    status = 409


class TrancheImpaired(DomainError):
    """This tranche has been fully written down and cannot accept deposits."""
    code = "TRANCHE_IMPAIRED"
    status = 409


class InsufficientBalance(DomainError):
    """Wallet balance is too low. Use the faucet to get demo USDC."""
    code = "INSUFFICIENT_BALANCE"


class CreditExceeded(DomainError):
    """Requested amount exceeds the available credit line."""
    code = "CREDIT_EXCEEDED"


class ActiveLoanExists(DomainError):
    """This borrower already has an active loan."""
    code = "ACTIVE_LOAN_EXISTS"
    status = 409


class NotFound(DomainError):
    """Not found."""
    code = "NOT_FOUND"
    status = 404


class StepOutOfOrder(DomainError):
    """Complete the previous onboarding step first."""
    code = "STEP_OUT_OF_ORDER"
    status = 409


class ReceiptInvalid(DomainError):
    """A payment receipt failed validation."""
    code = "RECEIPT_INVALID"


class ThresholdNotMet(DomainError):
    """Revenue does not meet the requested threshold, so no proof can exist."""
    code = "THRESHOLD_NOT_MET"


class ProofInvalid(DomainError):
    """The proof did not verify."""
    code = "PROOF_INVALID"


class ProofMismatch(DomainError):
    """The proof's public inputs do not match the notarized attestation."""
    code = "PROOF_MISMATCH"


class ProverUnavailable(DomainError):
    """The ZK prover is not available."""
    code = "PROVER_UNAVAILABLE"
    status = 503


class Unauthorized(DomainError):
    """Sign in with your wallet first."""
    code = "UNAUTHORIZED"
    status = 401


class SimDisabled(DomainError):
    """Simulation controls are disabled."""
    code = "SIM_DISABLED"
    status = 403


class BorrowerInDefault(DomainError):
    """This borrower has a defaulted loan and cannot open or draw new credit."""
    code = "BORROWER_IN_DEFAULT"
    status = 409
