# Деплой на GitHub и Railway.app

## Часть 1: Деплой на GitHub

### 1. Создайте репозиторий на GitHub

1. Перейдите на https://github.com/new
2. Название: `potolkoff-telegram-bot` (или любое другое)
3. Описание: `Telegram bot for Potolkoff studio - request management system`
4. Тип: Public или Private (на ваш выбор)
5. **НЕ отмечайте галочку** "Initialize this repository with a README"
6. Нажмите "Create repository"

### 2. Подключите локальный репозиторий к GitHub

В терминале выполните команды (замените USERNAME на ваш GitHub username):

```bash
cd "C:\Users\dylyk\.openclaw\workspace\potolkoff-telegram-bot"

# Если вы создали репозиторий как private
git remote add origin https://github.com/YOUR_USERNAME/potolkoff-telegram-bot.git

# Или если используете SSH ключи
git remote add origin git@github.com:YOUR_USERNAME/potolkoff-telegram-bot.git

# Переименуем ветку в main (если нужно)
git branch -M main

# Отправляем код на GitHub
git push -u origin main
```

### 3. Проверьте репозиторий

Откройте ваш репозиторий на GitHub — там должны быть файлы:
- `.gitignore`
- `bot.js`
- `package.json`
- `package-lock.json`

**Важно**: в репозитории не должно быть файлов `.env` и `requests.json` — они исключены через `.gitignore`.

---

## Часть 2: Деплой на Railway.app

### 1. Регистрация на Railway

1. Перейдите на https://railway.app/
2. Нажмите "Login" → "Continue with GitHub"
3. Авторизуйтесь через ваш GitHub аккаунт

### 2. Создание проекта

1. Нажмите "New Project" (+)
2. Выберите "Deploy from GitHub repo"
3. Выберите репозиторий `potolkoff-telegram-bot`
4. Нажмите "Add Deploys"

### 3. Настройка переменных окружения

Railway автоматически определит Node.js проект. После импорта:

1. Нажмите на созданный проект
2. Перейдите в "Variables" (иконка шестерёнки)
3. Добавьте переменные:

| Key | Value | Description |
|-----|-------|-------------|
| `BOT_TOKEN` | `8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0` | Токен Telegram бота |
| `ADMIN_ID` | `336963709` | Ваш Telegram ID для уведомлений |
| `NODE_ENV` | `production` | Окружение |

### 4. Получение URL бота

1. Railway автоматически назначит URL бота
2. Формат: `https://<project-name>-production.up.railway.app`
3. Скопируйте этот URL

### 5. Настройка Webhook для Telegram

В терминале выполните (замените YOUR_RAILWAY_URL на ваш URL):

```bash
curl -F "url=https://YOUR_RAILWAY_URL" https://api.telegram.org/bot8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0/setWebhook
```

Пример:
```bash
curl -F "url=https://potolkoff-bot-production.up.railway.app" https://api.telegram.org/bot8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0/setWebhook
```

### 6. Изменение bot.js для Webhook mode

В файле `bot.js` замените:

```javascript
// Было:
bot.launch()

// Нужно:
bot.launch({
  webhook: {
    domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
    port: process.env.PORT || 3000
  }
})
```

### 7. Автоматический деплой

После изменения `bot.js`:

1. Сделайте commit и push на GitHub:
```bash
git add bot.js
git commit -m "chore: add webhook support"
git push origin main
```

2. Railway автоматически обнаружит изменения и перезапустит бот

---

## Часть 3: Устранение проблем

### Ошибка 409 (Conflict)

Если бот запущен локально — остановите его:

```bash
pm2 stop potolkoff-bot
```

### Ошибка 400 (Bad Request)

Проверьте webhook URL — должен быть HTTPS и без порта.

### Бот не отвечает

1. Проверьте логи Railway (в интерфейсе проекта)
2. Убедитесь, что переменные окружения настроены правильно
3. Проверьте webhook статус:
```bash
curl https://api.telegram.org/bot8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0/getWebhookInfo
```

### Удаление webhook (для возврата к polling)

```bash
curl https://api.telegram.org/bot8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0/deleteWebhook
```

---

## Полезные команды

### Проверка статуса PM2 (локально)
```bash
pm2 status
pm2 logs potolkoff-bot
```

### Проверка webhook
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Логи Railway
- В интерфейсе проекта → "Deployments" → Логи конкретного деплоя

---

## Что дальше?

После деплоя бот будет работать 24/7 на Railway.app:

- Бесплатно: 500 часов/мес, 512 MB RAM
- Автоматический редеплой при коммитах в GitHub
- Стабильная работа (нет зависаний как на локальном)

---

## Документация

- Railway: https://docs.railway.app/
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegraf: https://telegraf.js.org/
