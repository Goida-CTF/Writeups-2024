from Crypto.Util.number import isPrime, bytes_to_long, getPrime
from secrets import randbits
import os


FLAG = "goidactf{c0pp3rsm1th_r3a11y_1s_4_f4nt4st1c_t00l_5d8af071}"

p, q = getPrime(512), getPrime(512)
n = p * q
print(f"{n = }")
# hmm too simple for my taste

p = 0
while not isPrime(p):
    a = randbits(128)
    p = pow(n + 1, a, n ** 2)

q = 0
while not isPrime(q):
    b = randbits(1024)
    q = pow(b, n, n ** 2)

# 2000 bit primes!! unbreakable

# just RSA
N = p * q
print(f"{N = }")
phi = (p - 1) * (q - 1)

e = 0x10001
d = pow(e, -1, phi)

m = bytes_to_long(FLAG.encode())
assert m < N

ct = pow(m, e, N)
assert pow(ct, d, N) == m

print(f"{e = }")
print(f"{ct = }")
