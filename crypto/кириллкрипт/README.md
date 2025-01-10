# Кириллкрипт
**Категория:** Чеченские головоломки (crypto)\
**Автор:** [maximxls](https://t.me/maximxlss)\
**Количество решений:** 1

Крипта на расте ураа (с очень уместным функциональным кодом)\
Флаг состоит из русских букв и фигурных скобок в формате "ГойдаСтф{...}", суммарно 55 символов.\
P.S. мой сплоит занимает 30 секунд на одном ядре AMD Ryzen 7 8845HS, но срабатывает не каждый раз.

### Решение
Если присмотреться, можно разобраться, что в таске реализована ранцевая криптосистема Меркля-Хеллмана. В этой криптосистеме известные биты сообщения и, соотвественно, некоторые элементы ключа, могут быть проигнорированы/вычтены из результата для сведения задачи к более простой.

По условию известно, что флаг имеет известную обертку и длину и состоит из русских букв. Русские буквы всегда имеют вид `1101000_ 10______` в кодировке UTF-8, что дает нам 4 известных нуля и 4 известных единицы на букву + полностью известная обертка. Это сокращает задачу достаточно, чтобы вытащить нужные элементы ключа было можно даже с ограничением на длину ввода (для этого достаточно вводить блоки из одной единицы в нужном месте). Теперь можно решить задачу.

Задуманный мной метод: low-density attack (можно найти в [позже прикрепленной в хинте статье](https://eprint.iacr.org/2009/537.pdf)). Сплоит:
```Python
from pwn import *
from time import time
from functools import reduce


context.encoding = "UTF-8"

t = time()

BLOCK_SIZE = 64
ENCRYPT_BLOCK_SIZE = 80

# pi = process("./kirillcrypt")
pi = remote("z71qh2pt8jy9z28wylb2.tasks.goidactf.ru", 443, ssl=True)

# template = "ГойдаСтф{РедактедРедактедРедактедРедактедРедактедРедак}"
unknown = bytearray()
value = bytearray()
for c in "ГойдаСтф{":
    e = c.encode()
    unknown += b"\x00" * len(e)
    value += e
for _ in range(45):
    unknown += b"\x01\x3f"
    value += b"\xd0\x80"
unknown += b"\x00"
value += b"}"
padding_len = BLOCK_SIZE - len(unknown) % BLOCK_SIZE
unknown += b"\x00" * padding_len
value += bytes([padding_len]) * padding_len

needed_blocks = [unknown[i:i + BLOCK_SIZE] for i in range(0, len(unknown), BLOCK_SIZE)] + [value[i:i + BLOCK_SIZE] for i in range(0, len(value), BLOCK_SIZE)]
needed = reduce(lambda a, b: bytes(x | y for x, y in zip(a, b)), needed_blocks)
needed = int.from_bytes(needed, 'big')

pi.recvuntil("Мой зашифрованный флаг: ")
flag_enc = bytes.fromhex(pi.recvline().decode().strip())

payload = b"".join((1 << i).to_bytes(BLOCK_SIZE, 'big') for i in range(BLOCK_SIZE * 8) if (1 << i) & needed).hex()
pi.sendlineafter("> ", payload)
pi.recvuntil("Твой зашифрованный флаг: ")
payload_enc = bytes.fromhex(pi.recvline().decode().strip())
key = []
for i in range(BLOCK_SIZE * 8):
    if (1 << i) & needed:
        key.append(int.from_bytes(payload_enc[:ENCRYPT_BLOCK_SIZE], 'big'))
        payload_enc = payload_enc[ENCRYPT_BLOCK_SIZE:]
    else:
        key.append(-1)

pi.close()

total_time = time() - t
print(f"io/prepare time: {total_time}.")
t = time()


def get_knapsack_solutions(b, target):
    from sage.all import QQ, block_matrix, matrix, ones_matrix, isqrt

    N = (isqrt(len(b)) + 1) // 2

    basis = block_matrix(QQ, [
        [1, N * matrix(len(b), 1, b)],
        [ones_matrix(1, len(b)) * 1/2, N * target]
    ])
    basis = basis.LLL()

    for row in basis:
        if row[-1] != 0 or any(abs(x) > 1/2 for x in row):
            continue
        row = [int(x + 1/2) for x in row[:-1]]
        if sum(x for i, x in enumerate(b) if row[i]) != target:
            row = [1 - x for x in row]
        assert sum(x for i, x in enumerate(b) if row[i]) == target
        yield row

        
real_blocks = []

for block_idx in range((len(unknown) + BLOCK_SIZE - 1) // BLOCK_SIZE):
    block_unknowns = int.from_bytes(unknown[BLOCK_SIZE * block_idx : BLOCK_SIZE * block_idx + BLOCK_SIZE], 'big')
    block_values = int.from_bytes(value[BLOCK_SIZE * block_idx : BLOCK_SIZE * block_idx + BLOCK_SIZE], 'big')
    block_enc = int.from_bytes(flag_enc[ENCRYPT_BLOCK_SIZE * block_idx : ENCRYPT_BLOCK_SIZE * block_idx + ENCRYPT_BLOCK_SIZE], 'big')

    bit_ids = []
    bit_repr = []
    target = block_enc
    for i in range(BLOCK_SIZE * 8):
        assert not ((1 << i) & block_unknowns and (1 << i) & block_values)
        if (1 << i) & block_unknowns:
            bit_ids.append(i)
            bit_repr.append(key[i])
        elif (1 << i) & block_values:
            target -= key[i]

    print(f"Solving knapsack of size {len(bit_repr)}, wait a minute...")

    total_time += time() - t
    t = time()

    for sol in get_knapsack_solutions(bit_repr, target):
        total_time += time() - t
        print(f"solve time: {time() - t}")
        t = time()
        for bit_idx, bit_value in zip(bit_ids, sol):
            if bit_value:
                block_values |= 1 << bit_idx
        break
    else:
        raise ValueError("No solution")

    block = block_values.to_bytes(BLOCK_SIZE, 'big')
    real_blocks.append(block)

total_time += time() - t
print(f"total time: {total_time}")

result = b"".join(real_blocks)
padding_len = result[-1]
result = result[:-padding_len].decode()

print("result:")
print(result)
```

Другой рабочий метод: решение системы уравнений, составленной из множества зашифровок с разными ключами, спасибо @nanzert.
