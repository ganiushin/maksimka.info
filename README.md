# Резюме (RU/EN)

Статический сайт-резюме: текст лежит в JSON, страница собирается в браузере.

## Запуск

```bash
python3 serve.py
```

Откройте `http://127.0.0.1:8137/`. Другой порт: `python3 serve.py 9000`.

Двойным кликом `index.html` не откроется: браузер не даёт странице читать JSON
с диска. `serve.py` — это обычный локальный сервер, который дополнительно
запрещает браузеру кэшировать файлы, поэтому правки видны после простого
обновления страницы.

## Структура

- `index.html` — каркас страницы.
- `styles.css` — стили, включая версию для печати.
- `app.js` — сборка страницы из JSON, переключение RU/EN, просмотр фото.
- `data/resume-content.json` — резюме на двух языках.
- `data/projects.json` — блоки раздела «Проекты и публикации».
- `assets/media/` — фото и скриншоты.
- `serve.py` — локальный сервер для просмотра.

После правок в `styles.css` или `app.js` увеличьте `?v=` в `index.html`, чтобы
браузер не взял старую копию (важно, если сайт выложен на обычный хостинг).

## Как обновлять текст

### Резюме — `data/resume-content.json`

Блоки `ru` и `en` устроены одинаково, меняйте их парой.

- `fullName`, `headline`, `contacts`, `profile`
- `experience` — список мест работы: `period`, `role`, `company`, `points`.
  Место с «н.в.» или «Present» в `period` отмечается на шкале как текущее.
- `skills` — группы: `{ "title": "Тестирование", "items": ["ADAS Testing", "..."] }`
- `languages`, `education`, `additional` — простые списки.

### Проекты — `data/projects.json`

Один элемент `items` — один блок, то есть одна тема. Тексты задаются парой
`{ "ru": "...", "en": "..." }`.

```json
{
  "label": { "ru": "Яндекс Образование, 2026", "en": "Yandex Education, 2026" },
  "title": { "ru": "Кубок Яндекс Образования", "en": "Yandex Education Cup" },
  "description": { "ru": "…", "en": "…" },
  "gallery": [
    { "src": "./assets/media/yandex-cup-robot.jpg", "caption": { "ru": "…", "en": "…" } }
  ],
  "links": [
    { "url": "https://github.com/YandexEducation/robot", "text": { "ru": "Код на GitHub", "en": "Code on GitHub" } }
  ]
}
```

- `gallery` — фото блока. Первое становится обложкой, по клику открывается
  просмотр со всеми фото.
- `src` — вместо `gallery`, если картинка одна. Можно задать разную для языков:
  `{ "ru": "./assets/media/amiok-ru.png", "en": "./assets/media/amiok-en.png" }`.
- `fit: "contain"` — показывать картинку целиком, без обрезки (для схем).
- `links` — ссылки под описанием; блок без картинок и ссылок тоже допустим.

### Фото

Положите файл в `assets/media/` и укажите путь в `src`. Большие снимки стоит
уменьшить до 1600 пикселей по длинной стороне:

```bash
sips -Z 1600 -s format jpeg -s formatOptions 82 оригинал.jpg --out assets/media/имя.jpg
```
