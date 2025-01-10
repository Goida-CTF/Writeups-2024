#![feature(slice_as_chunks, iter_array_chunks)]
use anyhow::{Result, bail};
use crypto_bigint::{
    rand_core::OsRng, CheckedAdd, CheckedSub, Encoding, NonZero, RandomMod, U512, U640
};
use crypto_primes::generate_prime;
use rand::seq::SliceRandom;
use concat_arrays::concat_arrays;

const BLOCK_SIZE: usize = 64;
type UBlock = U512;
type UEncrypt = U640;

const _: () = assert!(BLOCK_SIZE <= UBlock::BYTES);
const _: () = assert!(BLOCK_SIZE * 8 + 2 <= UEncrypt::BITS);

pub struct PublicKey {
    b: [UEncrypt; BLOCK_SIZE * 8]
}

impl PublicKey {
    pub(crate) fn encrypt_integer(&self, data: &UBlock) -> UEncrypt {
        self.b
            .into_iter()
            .enumerate()
            .filter_map(|(i, v)| Into::<bool>::into(data.bit(i)).then_some(v))
            .fold(UEncrypt::ZERO, |x, y| x.checked_add(&y).unwrap())
    }

    pub(crate) fn encrypt_block(&self, data: &[u8; BLOCK_SIZE]) -> [u8; UEncrypt::BYTES] {
        let prepend = [0u8; UBlock::BYTES - BLOCK_SIZE];
        self.encrypt_integer(&UBlock::from_be_bytes(concat_arrays!(prepend, *data)))
            .to_be_bytes()
    }

    pub fn encrypt_bytes(&self, data: &[u8]) -> Vec<u8> {
        let (full_blocks, tail) = data.as_chunks();
        let padding_len = BLOCK_SIZE - tail.len();
        let padded_tail: [u8; BLOCK_SIZE] = [tail, &vec![padding_len as u8; padding_len]]
            .concat()
            .try_into()
            .unwrap();

        full_blocks
            .into_iter()
            .chain(std::iter::once(&padded_tail))
            .flat_map(|block| self.encrypt_block(block))
            .collect()
    }

    pub fn encrypt_string(&self, data: &str) -> Vec<u8> {
        self.encrypt_bytes(data.as_bytes())
    }
}

pub struct PrivateKey {
    p: UEncrypt,
    w: [UEncrypt; BLOCK_SIZE * 8],
    b: [UEncrypt; BLOCK_SIZE * 8],
    k_inv: UEncrypt,
    pi_inv: [usize; BLOCK_SIZE * 8],
}

impl PrivateKey {
    pub fn generate() -> Self {
        let p: UEncrypt = generate_prime(Some(BLOCK_SIZE * 8 + 2));
        let k = UEncrypt::random_mod(&mut OsRng, &NonZero::new(p).unwrap());
        let mut w_sum = UEncrypt::ZERO;
        let w: [UEncrypt; BLOCK_SIZE * 8] = (1..=(BLOCK_SIZE * 8))
            .map(|bit_size| {
                let modulus = (UEncrypt::ONE << bit_size)
                    .checked_sub(&w_sum)
                    .unwrap()
                    .checked_sub(&UEncrypt::ONE)
                    .unwrap();
                let delta = UEncrypt::random_mod(
                    &mut OsRng,
                    &NonZero::new(modulus).unwrap(),
                );
                let x = w_sum
                    .checked_add(&UEncrypt::ONE)
                    .unwrap()
                    .checked_add(&delta)
                    .unwrap();
                assert!(x > w_sum);
                w_sum = w_sum.checked_add(&x).unwrap();
                assert!(x.bits() <= BLOCK_SIZE * 8);
                x
            })
            .collect::<Vec<UEncrypt>>()
            .try_into()
            .unwrap();
        let mut pi: [usize; BLOCK_SIZE * 8] = core::array::from_fn(|i| i);
        pi.shuffle(&mut OsRng);
        let b = (0..(BLOCK_SIZE * 8))
            .map(|i| w[pi[i]].mul(&k).checked_rem(&p.resize()).unwrap().resize())
            .collect::<Vec<UEncrypt>>()
            .try_into()
            .unwrap();
        let (k_inv, does_exist) = k.inv_mod(&p.resize());
        assert!(Into::<bool>::into(does_exist));
        let mut pi_inv = [0; BLOCK_SIZE * 8];
        for (i, x) in pi.into_iter().enumerate() {
            pi_inv[x] = i;
        }
        PrivateKey {
            p,
            w,
            b,
            k_inv,
            pi_inv,
        }
    }

    pub fn public_key(&self) -> PublicKey {
        return PublicKey { b: self.b.clone() };
    }

    pub(crate) fn decrypt_integer(&self, data: &UEncrypt) -> UBlock {
        let mut naked_data = data
            .mul(&self.k_inv)
            .checked_rem(&self.p.resize())
            .unwrap()
            .resize();

        let mut result = [0u8; UBlock::BYTES];

        for i in (0..(BLOCK_SIZE * 8)).rev() {
            if naked_data >= self.w[i] {
                result[self.pi_inv[i] / 8] |= 1 << (self.pi_inv[i] % 8);
                naked_data = naked_data.checked_sub(&self.w[i]).unwrap();
            }
        }

        UBlock::from_le_bytes(result)
    }

    pub(crate) fn decrypt_block(&self, data: &[u8; UEncrypt::BYTES]) -> [u8; BLOCK_SIZE] {
        let result = self.decrypt_integer(&UEncrypt::from_be_bytes(*data)).to_be_bytes();
        result[(result.len()-BLOCK_SIZE)..].try_into().unwrap()
    }

    pub fn decrypt_bytes(&self, data: &[u8]) -> Result<Vec<u8>> {
        let (full_blocks, []) = data.as_chunks() else {
            bail!("Invalid ciphertext");
        };
        if full_blocks.is_empty() {
            return Ok(vec![]);
        }
        let mut decrypted: Vec<u8> = full_blocks
            .into_iter()
            .flat_map(|block| self.decrypt_block(block))
            .collect();
        let padding_len = decrypted.last().unwrap();
        decrypted.truncate(decrypted.len() - *padding_len as usize);
        Ok(decrypted)
    }

    pub fn decrypt_string(&self, data: &[u8]) -> Result<String> {
        Ok(String::from_utf8(self.decrypt_bytes(data)?)?)
    }
}

#[cfg(test)]
mod tests {
    use rand::RngCore;

    use super::*;

    #[test]
    fn integer_encryption() {
        for _ in 0..5 {
            let private_key = PrivateKey::generate();
            let public_key = private_key.public_key();
            for _ in 0..5 {
                let data: UBlock = UEncrypt::random_mod(&mut OsRng, &NonZero::new(UEncrypt::ONE << (BLOCK_SIZE * 8)).unwrap()).resize();
                let encrypted = public_key.encrypt_integer(&data);
                let decrypted = private_key.decrypt_integer(&encrypted);
                assert_eq!(decrypted, data);
            }
        }
    }

    #[test]
    fn block_encryption() {
        for _ in 0..5 {
            let private_key = PrivateKey::generate();
            let public_key = private_key.public_key();
            for _ in 0..5 {
                let mut data = [0u8; BLOCK_SIZE];
                rand::thread_rng().fill_bytes(&mut data);
                let encrypted = public_key.encrypt_block(&data);
                let decrypted = private_key.decrypt_block(&encrypted);
                assert_eq!(decrypted, data);
            }
        }
    }

    #[test]
    fn bytes_encryption() {
        for _ in 0..5 {
            let private_key = PrivateKey::generate();
            let public_key = private_key.public_key();
            for _ in 0..5 {
                let mut data = [0u8; BLOCK_SIZE * 3 + 17];
                rand::thread_rng().fill_bytes(&mut data);
                let encrypted = public_key.encrypt_bytes(&data);
                let decrypted = private_key.decrypt_bytes(&encrypted).unwrap();
                assert_eq!(decrypted, data);
            }
        }
    }

    #[test]
    fn string_encryption() {
        let data = "this is a string фо тестинг to тест 3tu shtuku";
        let private_key = PrivateKey::generate();
        let public_key = private_key.public_key();
        let encrypted = public_key.encrypt_string(&data);
        let decrypted = private_key.decrypt_string(&encrypted).unwrap();
        assert_eq!(decrypted, data);
    }
}
