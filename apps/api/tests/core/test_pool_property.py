"""Balance-sheet identity holds across arbitrary operation sequences."""

from hypothesis import given, settings
from hypothesis import strategies as st

from credent.core.pool import Pool, PoolTerms, default, deposit, distribute, draw, recover, withdraw
from credent.errors import DomainError

amount = st.integers(min_value=1, max_value=10_000_000_00)
op = st.one_of(
    st.tuples(st.just("deposit"), st.sampled_from(["senior", "junior"]), amount),
    st.tuples(st.just("draw"), amount),
    st.tuples(st.just("distribute"), st.integers(0, 1_000_000_00), st.integers(0, 10_000_000_00)),
    st.tuples(st.just("default"), amount),
    st.tuples(st.just("recover"), amount),
    st.tuples(st.just("withdraw"), st.sampled_from(["senior", "junior"]), st.integers(1, 10**15)),
)
terms_st = st.builds(PoolTerms, senior_coupon_bps=st.integers(0, 2500),
                     max_leverage_x100=st.integers(100, 1000), fee_bps=st.integers(0, 3000))


@settings(max_examples=300, deadline=None)
@given(st.lists(op, max_size=40), terms_st)
def test_identity_holds(ops, terms):
    p = Pool()
    for o in ops:
        try:
            match o:
                case ("deposit", t, a):
                    p, _ = deposit(p, t, a, terms)
                case ("draw", a):
                    p = draw(p, a)
                case ("distribute", i, pr):
                    p, _ = distribute(p, interest=i, principal=min(pr, p.outstanding), days=7, terms=terms)
                case ("default", a):
                    p, _ = default(p, min(a, p.outstanding))
                case ("recover", a):
                    p, _ = recover(p, a)
                case ("withdraw", t, sh):
                    p, _ = withdraw(p, t, min(sh, p.tranche(t).shares) or 1, terms)
        except DomainError:
            pass
        p.check()
        for v in (p.cash, p.outstanding, p.treasury, p.senior.nav, p.junior.nav,
                  p.senior.writedown, p.junior.writedown, p.senior.coupon_arrears):
            assert v >= 0
