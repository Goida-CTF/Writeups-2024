# Дроби с ошибками
**Категория:** Чеченские головоломки (crypto)\
**Автор:** [maximxls](https://t.me/maximxlss)\
**Количество решений:** 23\

Всего-то сократить дробь... да?

### Решение
По мотивам атаки Винера на RSA, посчитаем конвергенты дроби. Среди них будет $\frac{m}{p}$, ведь она имеет разницу с данной дробью $<\frac{1}{2p^2}$. При помощи sagemath можно посчитать так:
```Python
from sage.all import *

a = ...
b = ...

convergents = continued_fraction(QQ(a) / b).convergents()

for frac in convergents:
    m = frac.numerator()
    try:
        print(int(m).to_bytes(64, 'big').decode())
    except (UnicodeDecodeError, OverflowError):
        pass

```
