# Гойдакрипт 3000


def _convert_to_base(x, base):
    digits = []
    while x != 0:
        digits.append(x % base)
        x //= base
    digits.reverse()
    return digits


def _convert_from_base(digits, base):
    value = 0
    for i, digit in enumerate(reversed(digits)):
        value += digit * base**i
    return value


def encrypt(encryption_key, message):
    mult, base = encryption_key

    key_len = len(_convert_to_base(mult, base))
    ct = message * mult
    digits = _convert_to_base(ct, base)
    digits = digits[-key_len:]
    ct = _convert_from_base(digits, base)

    return ct


def decrypt(encryption_key, ct):
    mult, base = encryption_key
    
    key_len = len(_convert_to_base(mult, base))
    modulus = base ** key_len
    message = ct * pow(mult, -1, modulus) % modulus

    return message
