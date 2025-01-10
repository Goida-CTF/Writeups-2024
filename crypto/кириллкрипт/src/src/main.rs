use std::io::{self, BufRead, Read, Write};

use kirillcrypt::PrivateKey;


fn main() {
    println!("КИРИЛЛКРИПТ 2025");
    println!("Генерирую ключ... Собираю рюкзак...");
    let private_key = PrivateKey::generate();
    let public_key = private_key.public_key();
    println!("Ключ сгенерирован.");
    
    let flag = std::env::var("FLAG").unwrap_or("ГойдаСтф{РедактедРедактедРедактедРедактедРедактедРедак}".to_string());
    let flag_encryption = public_key.encrypt_string(&flag);
    println!("Мой зашифрованный флаг: {}", hex::encode(flag_encryption));

    println!("Давай я и твой флаг зашифрую (в хексе).");
    print!("> ");
    io::stdout().flush().unwrap();

    let mut buffer = String::with_capacity(32);
    std::io::BufReader::new(io::stdin().take(55000))
        .read_line(&mut buffer)
        .unwrap();
    if !buffer.ends_with("\n") {
        panic!("Too long or EOF")
    }

    let data = hex::decode(buffer.trim()).expect("У тебя неправильный хекс");
    let encrypted = public_key.encrypt_bytes(&data);
    println!("Твой зашифрованный флаг: {}", hex::encode(encrypted));
}
