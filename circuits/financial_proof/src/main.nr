
fn main(
    revenue: u64,
    nonce: Field,
    threshold: pub u64,
    expected_commitment: pub Field
) {
    assert(revenue >= threshold);

    let commitment = std::hash::pedersen_hash([
        revenue as Field,
        nonce
    ]);

    assert(commitment == expected_commitment);
}

#[test]
fn test_revenue_meets_threshold() {
    let revenue = 2_500_000;
    let nonce = 12345;
    let threshold = 1_000_000;

    let commitment = std::hash::pedersen_hash([
        revenue as Field,
        nonce
    ]);

    main(
        revenue,
        nonce,
        threshold,
        commitment
    );
}
