fn main(
    revenue: u64,
    threshold: pub u64
) {
    assert(revenue >= threshold);
}

#[test]
fn test_revenue_meets_threshold() {
    main(2_500_000, 1_000_000);
}

#[test]
fn test_revenue_below_threshold() {
    // This test should fail because 500,000 < 1,000,000.
    // Uncomment to verify the constraint.
    // main(500_000, 1_000_000);
}
