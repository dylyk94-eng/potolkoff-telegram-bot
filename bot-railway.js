require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const express = require('express');

// --- НАСТРОЙКИ И ДАННЫЕ ---
const SERVICES = {
    'satin': {
        name: '✨ Сатиновые',
        price: 'от 2000 ₽/м²',
        description: 'Мягкое свечение, перламутровый отлив. Идеальны для спален.',
        img: 'https://via.placeholder.com/600x400.png?text=Satin'
    },
    'matte': {
        name: '☁️ Матовые',
        price: 'от 2000 ₽/м²',
        description: 'Нет бликов, идеально ровная поверхность. Классика и универсальность.',
        img: 'https://via.placeholder.com/600x400.png?text=Matte'
    },
    'gloss': {
        name: '🪞 Глянцевые',
        price: 'от 2000 ₽/м²',
        description: 'Зеркальный эффект, визуально увеличивают помещение.',
        img: 'https://via.placeholder.com/600x400.png?text=Gloss'
    },
    'fabric': {
        name: '🧵 Тканевые',
        price: 'от 2500 ₽/м²',
        description: 'Дышащий материал, премиум-качество. Выдерживают низкие температуры.',
        img: 'https://via.placeholder.com/600x400.png?text=Fabric'
    },
    'multi': {
        name: '🏛️ Многоуровневые',
        price: 'от 4500 ₽/м²',
        description: 'Архитектура света и зонирование. Встроенная LED-подсветка.',
        img: 'https://via.placeholder.com/600x400.png?text=Multi'
    },
    'photo': {
        name: '🖼️ С фотопечатью',
        price: 'от 3500 ₽/м²',
        description: 'Любое изображение на потолке. Фотографическая точность.',
        img: 'https://via.placeholder.com/600x400.png?text=Photo'
    }
};

// --- СЦЕНА ЗАЯВКИ ---
const orderWizard = new Scenes.WizardScene(
    'ORDER_SCENE',
    // Шаг 1: Выбор услуги
    async (ctx) => {
        ctx.wizard.state.formData = {};

        const keyboard = [];
        const keys = Object.keys(SERVICES);

        // Группируем по 2 кнопки в ряд
        for (let i = 0; i < keys.length; i += 2) {
            const row = [];
            row.push(Markup.button.callback(SERVICES[keys[i]].name, `service_${keys[i]}`));
            if (keys[i + 1]) {
                row.push(Markup.button.callback(SERVICES[keys[i + 1]].name, `service_${keys[i + 1]}`));
            }
            keyboard.push(row);
        }
        keyboard.push([Markup.button.callback('❌ Отмена', 'cancel_order')]);

        await ctx.reply('📋 <b>Шаг 1 из 4:</b> Выберите тип потолка', {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(keyboard)
        });

        return ctx.wizard.next();
    },
    // Шаг 2: Площадь
    async (ctx) => {
        if (ctx.callbackQuery) {
            if (ctx.callbackQuery.data === 'cancel_order') return leaveScene(ctx);

            const serviceKey = ctx.callbackQuery.data.replace('service_', '');
            ctx.wizard.state.formData.service = SERVICES[serviceKey].name;
            await ctx.answerCbQuery();
        }

        await ctx.reply('📐 <b>Шаг 2 из 4:</b> Укажите примерную площадь помещения (в м²):', {
            parse_mode: 'HTML'
        });

        return ctx.wizard.next();
    },
    // Шаг 3: Адрес
    async (ctx) => {
        const area = parseFloat(ctx.message?.text);

        if (isNaN(area) || area <= 0) {
            return ctx.reply('⚠️ Пожалуйста, введите корректное число (например: 25)');
        }

        ctx.wizard.state.formData.area = area;
        await ctx.reply('🏠 <b>Шаг 3 из 4:</b> Напишите адрес для выезда замерщика (улица, дом, квартира):', {
            parse_mode: 'HTML'
        });

        return ctx.wizard.next();
    },
    // Шаг 4: Телефон
    async (ctx) => {
        if (ctx.message?.text.length < 3) {
            return ctx.reply('⚠️ Пожалуйста, введите полный адрес.');
        }

        ctx.wizard.state.formData.address = ctx.message.text;

        await ctx.reply('📞 <b>Шаг 4 из 4:</b> Отправьте ваш номер телефона:', {
            parse_mode: 'HTML',
            reply_markup: Markup.keyboard([
                [Markup.button.contactRequest('📱 Отправить мой номер')],
                ['Пропустить (введу вручную)']
            ]).oneTime().resize()
        });

        return ctx.wizard.next();
    },
    // Финал: Отправка заявки
    async (ctx) => {
        let phone;

        if (ctx.message?.contact) {
            phone = ctx.message.contact.phone_number;
        } else if (ctx.message?.text) {
            phone = ctx.message.text;
        } else {
            return ctx.reply('⚠️ Пожалуйста, отправьте номер телефона.');
        }

        ctx.wizard.state.formData.phone = phone;
        ctx.wizard.state.formData.source = ctx.session.source || 'organic';

        const data = ctx.wizard.state.formData;
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : 'Скрыт';

        // Сообщение для админа/канала
        const adminMsg = `
🆕 <b>НОВАЯ ЗАЯВКА</b>

👤 <b>Клиент:</b> <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> (${username})
📞 <b>Телефон:</b> <code>${data.phone}</code>
🛠 <b>Услуга:</b> ${data.service}
📐 <b>Площадь:</b> ${data.area} м²
🏠 <b>Адрес:</b> ${data.address}
📢 <b>Источник:</b> ${data.source}

#id${userId} #новая
        `;

        try {
            // Отправляем админу
            if (process.env.ADMIN_ID) {
                await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, { parse_mode: 'HTML' });
            }

            // Отправляем в канал
            if (process.env.ORDER_CHANNEL_ID) {
                await ctx.telegram.sendMessage(process.env.ORDER_CHANNEL_ID, adminMsg, { parse_mode: 'HTML' });
            }

            await ctx.reply('✅ <b>Заявка принята!</b>\n\nМенеджер свяжется с вами в течение 15 минут для уточнения деталей и расчёта точной стоимости.', {
                parse_mode: 'HTML',
                reply_markup: Markup.removeKeyboard()
            });

            await ctx.reply('Чем еще могу помочь?', getMainMenu());

        } catch (e) {
            console.error(e);
            await ctx.reply('⚠️ Ошибка при отправке заявки. Попробуйте позже или позвоните нам: +7 (983) 420-88-05');
        }

        return ctx.wizard.leave();
    }
);

// Вспомогательная функция выхода
const leaveScene = async (ctx) => {
    await ctx.reply('❌ Оформление заявки отменено', getMainMenu());
    return ctx.scene.leave();
};

// --- ИНИЦИАЛИЗАЦИЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([orderWizard]);
const app = express();
const PORT = process.env.PORT || 3000;

bot.use(session());
bot.use(stage.middleware());

// --- ГЛАВНОЕ МЕНЮ ---
function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🎨 Каталог потолков', 'catalog_start')],
        [Markup.button.callback('📝 Заказать замер', 'start_order')],
        [Markup.button.callback('📞 Контакты', 'info'), Markup.button.callback('🏗️ Портфолио', 'portfolio')]
    ]);
}

// --- ОБРАБОТЧИКИ ---

// Старт
bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload) ctx.session.source = payload;

    ctx.replyWithHTML(
        `👋 Привет, <b>${ctx.from.first_name}</b>!\n\n` +
        `Я бот компании <b>Потолкоф</b> 🐾\n\n` +
        `Помогу:\n` +
        `🎨 Выбрать потолок из каталога\n` +
        `📝 Вызвать замерщика\n` +
        `📞 Связаться с нами`,
        getMainMenu()
    );
});

// Каталог
bot.action('catalog_start', async (ctx) => {
    const keys = Object.keys(SERVICES);
    const keyboard = [];

    for (let i = 0; i < keys.length; i += 2) {
        const row = [];
        row.push(Markup.button.callback(SERVICES[keys[i]].name, `cat_${keys[i]}`));
        if (keys[i + 1]) {
            row.push(Markup.button.callback(SERVICES[keys[i + 1]].name, `cat_${keys[i + 1]}`));
        }
        keyboard.push(row);
    }
    keyboard.push([Markup.button.callback('🔙 В меню', 'back_menu')]);

    await ctx.replyWithHTML(
        `<b>📂 Каталог потолков</b>\n\nВыберите тип потолка, чтобы узнать подробнее:`,
        Markup.inlineKeyboard(keyboard)
    );
});

// Детали услуги
Object.keys(SERVICES).forEach(key => {
    bot.action(`cat_${key}`, async (ctx) => {
        const item = SERVICES[key];

        await ctx.replyWithPhoto(item.img, {
            caption: `<b>${item.name}</b>\n\n💵 ${item.price}\n\n${item.description}\n\n✅ Идеально ровная поверхность\n✅ Монтаж за 1 день\n✅ Гарантия 5 лет`,
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('📝 Заказать этот вид', `order_${key}`)],
                [Markup.button.callback('🔙 К каталогу', 'catalog_start')]
            ])
        });
    });
});

// Заказать определённый вид из каталога
Object.keys(SERVICES).forEach(key => {
    bot.action(`order_${key}`, async (ctx) => {
        ctx.wizard.state = { formData: { service: SERVICES[key].name } };
        await ctx.answerCbQuery();
        await ctx.reply('📐 <b>Шаг 2 из 4:</b> Укажите примерную площадь помещения (в м²):', {
            parse_mode: 'HTML'
        });
        ctx.scene.enter('ORDER_SCENE');
        // Пропускаем первый шаг
        ctx.wizard.selectStep(2);
    });
});

// Заказать замер
bot.action('start_order', (ctx) => ctx.scene.enter('ORDER_SCENE'));

// Контакты
bot.action('info', (ctx) => {
    ctx.replyWithHTML(
        `<b>📞 Контакты Потолкоф</b>\n\n` +
        `📱 Телефон: <code>+7 (983) 420-88-05</code>\n` +
        `💬 Telegram: @potolkoff2024\n` +
        `🌐 VK: vk.com/potolkoff03\n` +
        `📸 Instagram: @potolkoff_03\n\n` +
        `🕒 Режим работы:\nПн-Пт: 9:00 - 18:00\nСб-Вс: выходной\n` +
        `📍 Улан-Удэ и Бурятия`,
        Markup.inlineKeyboard([
            [Markup.button.url('💬 Написать в Telegram', 'https://t.me/potolkoff2024')],
            [Markup.button.url('📱 Позвонить', 'tel:+79834208805')],
            [Markup.button.callback('🔙 В меню', 'back_menu')]
        ])
    );
});

// Портфолио
bot.action('portfolio', (ctx) => {
    ctx.replyWithHTML(
        `<b>🏗️ Портфолио наших работ</b>\n\n` +
        `✨ Выполнено более 1200 объектов!\n\n` +
        `🎨 Что мы делаем:\n` +
        `• Натяжные потолки в квартирах и домах\n` +
        `• Многоуровневые конструкции с подсветкой\n` +
        `• 3D-потолки с фотопечатью\n` +
        `• Комплексный ремонт под ключ\n\n` +
        `📊 Статистика:\n` +
        `• 1200+ выполненных объектов\n` +
        `• 500+ довольных клиентов\n` +
        `• 8 лет на рынке\n` +
        `• 98% рекомендаций`,
        Markup.inlineKeyboard([
            [Markup.button.url('📸 Фото работ', 'https://vk.com/potolkoff03')],
            [Markup.button.url('🎥 Видеообзоры', 'https://t.me/potolkoff2024')],
            [Markup.button.url('💬 Отзывы клиентов', 'https://vk.com/topic-172808215_48667766')],
            [Markup.button.callback('🔙 В меню', 'back_menu')]
        ])
    );
});

// Назад в меню
bot.action('back_menu', (ctx) => {
    ctx.reply('Главное меню:', getMainMenu());
});

// Админ-функция: Ответ пользователю
bot.on('text', async (ctx) => {
    if (ctx.from.id == process.env.ADMIN_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

        if (!replyText) return;

        const match = replyText.match(/#id(\d+)/);

        if (match) {
            const userId = match[1];

            try {
                await ctx.telegram.sendMessage(userId, `👨‍💼 <b>Сообщение от менеджера:</b>\n\n${ctx.message.text}`, {
                    parse_mode: 'HTML'
                });
                await ctx.reply('✅ Сообщение отправлено клиенту.');
            } catch (e) {
                await ctx.reply('❌ Не удалось отправить. Возможно, бот заблокирован клиентом.');
            }
        } else {
            await ctx.reply('⚠️ Не найден ID пользователя в сообщении (ищу тег #id...)');
        }
    }
});

// ============================================
// Webhook setup for Railway
// ============================================

app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => {
    res.send('🤖 Potolkoff Telegram Bot is running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', bot: 'active' });
});

const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
    : null;

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    if (WEBHOOK_URL) {
        try {
            await bot.telegram.setWebhook(WEBHOOK_URL);
            console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
        } catch (error) {
            console.error('❌ Error setting webhook:', error);
        }
    } else {
        console.log('⚠️  WEBHOOK_URL not set, webhook not configured');
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
