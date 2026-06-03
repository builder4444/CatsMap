use rand::Rng;

/// Generate a cute share code like "PURR-MEOW-4729"
pub fn generate_code() -> String {
    let words1 = ["PURR", "MEOW", "PAW", "FUZZ", "POUNCE", "KITTY", "WHISKER"];
    let words2 = ["MEOW", "PURR", "CLAW", "TAIL", "SNOOT", "BOOP", "FLOOF"];
    let mut rng = rand::thread_rng();
    let n: u16 = rng.gen_range(1000..9999);
    format!(
        "{}-{}-{}",
        words1[rng.gen_range(0..words1.len())],
        words2[rng.gen_range(0..words2.len())],
        n
    )
}
