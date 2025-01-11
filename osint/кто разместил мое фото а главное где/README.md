# Кто разместил мое фото, а главное где
**Категория:** osint\
**Автор:** [Doom](https://t.me/dontunique)\
**Количество решений:** 35\
**Категория:** osint

Просыпаюсь утром, а мне скидывают мое фото... но где это?



Формат флага: goidactf{xx.xxxxx, yy.yyyyy}

### Решение
1. Ищем подобную картинку в гугл(яндекс) фото и видим, что есть фотографии прям с того же места
2. Переходим на карту, где стоят геометки на карте: https://www.google.com/maps/@55.7623716,37.5791361,2a,75y,56.54h,86.62t/data=!3m10!1e1!3m8!1sfKfW52xg9G7phF92_cpazA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D3.3816411423759973%26panoid%3DfKfW52xg9G7phF92_cpazA%26yaw%3D56.5380338557629!7i13312!8i6656!9m2!1b1!2i36?entry=ttu&g_ep=EgoyMDI1MDEwMi4wIKXMDSoASAFQAw%3D%3D
3. Копируем координаты: 55.7623716,37.5791361
4. Сокращаем координаты до 5 символов после (.): goidactf{55.76237, 37.57914}
