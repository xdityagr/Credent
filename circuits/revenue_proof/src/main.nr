global DAYS: u32 = 90;

fn main(daily: [u64; DAYS], salt: Field, threshold: pub u64) -> pub Field {
    let mut total: u64 = 0;
    for i in 0..DAYS {
        total += daily[i];
    }
    assert(total >= threshold);
    let mut inputs: [Field; DAYS + 1] = [0; DAYS + 1];
    for i in 0..DAYS {
        inputs[i] = daily[i] as Field;
    }
    inputs[DAYS] = salt;
    std::hash::pedersen_hash(inputs)
}

#[test]
fn test_meets_threshold() {
    let daily = [1000; DAYS];
    let _ = main(daily, 7, 90000);
}

#[test(should_fail)]
fn test_below_threshold() {
    let daily = [1000; DAYS];
    let _ = main(daily, 7, 90001);
}

#[test]
fn test_commitment_binds_each_day() {
    let a = [1000; DAYS];
    let mut b = [1000; DAYS];
    b[45] = 1001;
    assert(main(a, 7, 0) != main(b, 7, 0));
}
