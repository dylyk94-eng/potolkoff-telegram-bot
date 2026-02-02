// Добавь это в конец файла bot.js для поддержки Railway

// Поддержка webhook для Railway
const PORT = process.env.PORT || 3000;
const app = express();

// Проверка режима работы (webhook или polling)
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

if (USE_WEBHOOK) {
    // Webhook mode
    console.log('Запускаем в Webhook режиме');

    app.use(bot.webhookCallback('/telegram-webhook'));

    app.get('/', (req, res) => {
        res.send('Бот Потолкоф запущен!');
    });

    app.listen(PORT, () => {
        console.log('Слушаем на порту:', PORT);
        console.log('Webhook URL:', process.env.WEBHOOK_URL || 'https://potolkoff-telegram-bot-v3-production.up.railway.app/telegram-webhook');
    });

    // Устанавливаем webhook
    const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://potolkoff-telegram-bot-v3-production.up.railway.app/telegram-webhook';
    bot.telegram.setWebhook(WEBHOOK_URL)
        .then(() => {
            console.log('Webhook установлен!');
        })
        .catch(err => {
            console.error('Ошибка при установке webhook:', err);
        });
}

// Обработка остановки процесса
process.once('SIGINT', () => {
    console.log('Получен SIGINT');
    if (USE_WEBHOOK) {
        process.exit(0);
    } else {
        bot.stop('SIGINT');
    }
});

process.once('SIGTERM', () => {
    console.log('Получен SIGTERM');
    if (USE_WEBHOOK) {
        process.exit(0);
    } else {
        bot.stop('SIGTERM');
    }
});
