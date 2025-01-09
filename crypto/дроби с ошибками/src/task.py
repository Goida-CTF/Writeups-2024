from Crypto.Util.number import bytes_to_long, getPrime, getRandomNBitInteger


SIZE = 512

m = bytes_to_long(b"goidactf{REDACTEDREDACTEDREDACTEDREDACTEDREDACTEDREDA}")
assert m.bit_length() < SIZE

p = getPrime(SIZE)
assert p > m

q = getPrime(SIZE * 4)
a, b = m * q + getRandomNBitInteger(SIZE), p * q + getRandomNBitInteger(SIZE)

# px - my / (p * pq + py)

print(f"{a}/{b}")
