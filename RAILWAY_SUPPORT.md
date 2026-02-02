# Поддержка Railway для бота Потолкоф

В файле bot.js нужно заменить последние строки на код из файла bot-railway.js.

## Что делать:

1. Открой bot.js
2. Найди последние строки в конце:
```javascript
    .then(() => {
        console.log('Telegram бот запущен успешно!');
    })
    .catch(err => {
        console.error('Ошибка при запуске бота:', err);
    });

// Обработка остановки процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

3. Замени их на код из bot-railway.js (файл в этой же папке)

## Режимы работы

### Polling режим (по умолчанию)
- Бот работает через long polling
- Автоматически делает пинг каждые 5 минут
- Работает локально и на Railway

### Webhook режим (опционально)
- Для использования установи переменную: `USE_WEBHOOK=true`
- Также нужна переменная: `WEBHOOK_URL=https://your-railway-url.up.railway.app/telegram-webhook`
- Более быстрый и надёжный для продакшена

## Настройка переменных в Railway

Добавь следующие переменные окружения:

```
BOT_TOKEN=8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0
NODE_ENV=production
USE_WEBHOOK=false
PORT=3000
```

Для Webhook режима:
```
BOT_TOKEN=8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0
NODE_ENV=production
USE_WEBHOOK=true
WEBHOOK_URL=https://potolkoff-telegram-bot-v3-production.up.railway.app/telegram-webhook
PORT=3000
```

## Проверка работы

После деплоя:
1. Открой логи Railway
2. Должен быть вывод: "Telegram бот запущен успешно!"
3. Каждые 5 минут: "Ping: бот работает"
4. Напиши боту в Telegram: `/start`
5. Бот должен ответить

## Автоматический редеплой

Railway автоматически редеплоит проект при коммите в GitHub.
Все изменения будут обновлены автоматически!
