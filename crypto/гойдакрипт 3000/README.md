# Гойдакрипт 3000
**Категория:** Чеченские головоломки (crypto)\
**Автор:** [maximxls](https://t.me/maximxlss)\
**Количество решений:** 18\

Я придумал криптосистему, но у моего друга какие-то странные ключи... Моя функция расшифровки не работает T-T

### Решение
По сути, мы получаем $ct=message\cdot mult\pmod{base^{keylen}}$. Можно просто поделить $ct$ на $mult$ по этому модулю и получить флаг. Чтобы программно делить многочлены по модулю, можно использовать sagemath вот так:
```Python
from sage.all import *
from encryption import _convert_to_base


p = 257
PR = PolynomialRing(GF(p), "x")
x = PR.gen()

base = 17*x**2 + 76*x + 20
mult = 46*x**96 + 188*x**95 + ...
ct = 47*x**97 + 48*x**96 + ...

key_len = len(_convert_to_base(mult, base))
QR = PR.quotient(base**key_len)

pt = QR(ct) / QR(mult)

flag = bytes(pt.lift().coefficients())

print(flag)
```
