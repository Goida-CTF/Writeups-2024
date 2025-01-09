from sage.all import *
from encryption import encrypt


FLAG = b"goidactf{REDACTEDREDACTEDREDACTEDREDACTEDREDACTEDREDACTEDRE}"

p = 257
PR = PolynomialRing(GF(p), "x")

mult = PR.random_element(96)
base = PR.random_element(2)
assert gcd(mult, base) == 1
encryption_key = (mult, base)

print(f"{base = }")
print(f"{mult = }")

message = PR(list(FLAG))
ct = encrypt(encryption_key, message)

print(f"{ct = }")
