require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const express = require('express');

// --- 1. БАЗА ДАННЫХ КАТАЛОГА ---
const CATALOG = {
    satin: {
        id: 'satin',
        name: '✨ Сатиновые потолки',
        price: 'от 2000 ₽/м²',
        desc: 'Эффект ткани с легким блеском. Идеально для спальни.',
        img: 'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg'
    },
    matte: {
        id: 'matte',
        name: '☁️ Матовые потолки',
        price: 'от 1800 ₽/м²',
        desc: 'Классика. Выглядит как идеально ровная побелка.',
        img: 'https://sk-potolok.ru/wp-content/uploads/2018/06/matoviy-natyazhnoy-potolok-foto-v-interere.jpg'
    },
    gloss: {
        id: 'gloss',
        name: '🪞 Глянцевые потолки',
        price: 'от 1900 ₽/м²',
        desc: 'Визуально увеличивают комнату. Яркие и эффектные.',
        img: 'https://potolki-lider.ru/wp-content/uploads/2019/10/glyancevye-potolki-v-zale.jpg'
    },
    fabric: {
        id: 'fabric',
        name: '🧵 Тканевые потолки',
        price: 'от 3500 ₽/м²',
        desc: 'Премиум материал. Дышащая структура, монтаж без нагрева.',
        img: 'https://potolkilid.ru/wp-content/uploads/2021/02/tkanevye-natyazhnye-potolki-foto.jpg'
    },
    lines: {
        id: 'lines',
        name: '🔦 Парящие линии',
        price: 'от 4500 ₽/м²',
        desc: 'Современный тренд. Светодиодные линии вместо люстры.',
        img: 'https://ferico.by/images/new/osveshchenie/linii/linii-1.jpg'
    },
    photo: {
        id: 'photo',
        name: '🖼️ С фотопечатью',
        price: 'от 3000 ₽/м²',
        desc: 'Любое изображение на потолке: небо, узоры, цветы.',
        img: 'https://cdn.potolkoff.ru/wp-content/uploads/2020/06/foto-potolok-v-detskuyu.jpg'
    }
};

// --- 2. СЦЕНА ЗАПИСИ НА ЗАМЕР (ORDER) ---
const orderWizard = new Scenes.WizardScene(
    'ORDER_SCENE',
    // Шаг 1: Приветствие и Контакт
    async (ctx) => {
        const interest = ctx.wizard.state.interest || 'Общая консультация';

        await ctx.reply(
            `🚀 Отличный выбор: <b>${interest}</b>!\n\n` +
            `Точную стоимость может сказать только технолог на замере (это бесплатно и ни к чему не обязывает).\n\n` +
            `📞 <b>Нажмите кнопку ниже, чтобы мы связались с вами:</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.keyboard([
                    [Markup.button.contactRequest('📱 Оставить телефон (Быстро)')],
                    ['🔙 Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Обработка контакта и Адрес
    async (ctx) => {
        if (ctx.message?.text === '🔙 Отмена') {
            await ctx.reply('❌ Заявка отменена', getMainMenu());
            return ctx.scene.leave();
        }

        // Получаем телефон (кнопкой или текстом)
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;

        // Валидация
        if (!ctx.message.contact && (!phone || phone.length < 5)) {
            await ctx.reply('⚠️ Пожалуйста, введите корректный номер телефона или нажмите кнопку.');
            return; // Остаемся на этом шаге
        }

        ctx.wizard.state.phone = phone;

        await ctx.reply('🏠 Напишите адрес объекта (Улица, Дом) или район:', {
            reply_markup: Markup.removeKeyboard() // Убираем кнопку телефона
        });

        return ctx.wizard.next();
    },
    // Шаг 3: Финал
    async (ctx) => {
        const address = ctx.message.text;
        const phone = ctx.wizard.state.phone;
        const interest = ctx.wizard.state.interest || 'Не выбрано';
        const source = ctx.session.source || 'Поиск';
        const user = ctx.from;

        // Формируем красивую заявку
        const adminMsg = `
🔥 <b>НОВАЯ ЗАЯВКА НА ЗАМЕР</b>

👤 <b>Имя:</b> <a href="tg://user?id=${user.id}">${user.first_name}</a>
📞 <b>Телефон:</b> <code>${phone}</code>
🏠 <b>Адрес:</b> ${address}
📌 <b>Интерес:</b> ${interest}
📢 <b>Источник:</b> ${source}

#id${user.id} #замер
        `;

        try {
            // 1. Отправляем в канал-базу
            if (process.env.ORDER_CHANNEL_ID) {
                await ctx.telegram.sendMessage(process.env.ORDER_CHANNEL_ID, adminMsg, { parse_mode: 'HTML' });
            }

            // 2. Отправляем админу (если указан)
            if (process.env.ADMIN_ID) {
                await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, { parse_mode: 'HTML' });
            }

            // 3. Ответ клиенту
            await ctx.reply(
                `✅ <b>Заявка принята!</b>\n\n` +
                `Менеджер уже получил ваш контакт и перезвонит в рабочее время.\n\n` +
                `🎁 А пока посмотрите наше портфолио или другие виды потолков.`,
                {
                    parse_mode: 'HTML',
                    ...getMainMenu()
                }
            );

        } catch (e) {
            console.error(e);
            await ctx.reply('⚠️ Ошибка сети. Попробуйте позже.');
        }

        return ctx.wizard.leave();
    }
);

// --- 3. ИНИЦИАЛИЗАЦИЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([orderWizard]);
const app = express();
const PORT = process.env.PORT || 3000;

bot.use(session());
bot.use(stage.middleware());

// --- 4. МЕНЮ И КЛАВИАТУРЫ ---
function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🎨 Каталог потолков', 'catalog_start')],
        [Markup.button.callback('📏 Записаться на замер', 'btn_order_general')],
        [Markup.button.callback('ℹ️ Контакты', 'info'), Markup.button.callback('📸 Наши работы', 'portfolio')]
    ]);
}

// --- 5. ОБРАБОТЧИКИ (HANDLERS) ---

// Start
bot.start((ctx) => {
    ctx.session.source = ctx.startPayload || 'organic';

    ctx.replyWithPhoto(
        'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        {
            caption: `👋 <b>Привет, ${ctx.from.first_name}!</b>\n\n` +
            `Это официальный бот компании <b>Потолкоф</b> 🐾\n` +
            `Здесь можно посмотреть каталог материалов и быстро вызвать мастера на бесплатный замер.`,
            parse_mode: 'HTML',
            ...getMainMenu()
        }
    );
});

// Запуск заявки (Общая)
bot.action('btn_order_general', (ctx) => {
    ctx.deleteMessage().catch(() => {});
    ctx.scene.enter('ORDER_SCENE', { interest: 'Общий замер' });
});

// КАТАЛОГ: Главная страница
bot.action('catalog_start', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(
        'https://via.placeholder.com/800x400?text=CATALOG',
        {
            caption: '<b>🎨 Каталог Потолкоф</b>\n\nВыберите вид потолка, чтобы увидеть фото и описание:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✨ Сатиновые', 'view_satin'), Markup.button.callback('☁️ Матовые', 'view_matte')],
                [Markup.button.callback('🪞 Глянцевые', 'view_gloss'), Markup.button.callback('🧵 Тканевые', 'view_fabric')],
                [Markup.button.callback('🔦 Линии', 'view_lines'), Markup.button.callback('🖼️ Фотопечать', 'view_photo')],
                [Markup.button.callback('🔙 В главное меню', 'back_home')]
            ])
        }
    );
});

// КАТАЛОГ: Просмотр товара (Динамический обработчик)
bot.action(/^view_(.+)$/, async (ctx) => {
    const typeId = ctx.match[1];
    const item = CATALOG[typeId];

    if (!item) return ctx.answerCbQuery('Ошибка каталога');

    await ctx.deleteMessage().catch(() => {}); // Убираем меню

    await ctx.replyWithPhoto(item.img, {
        caption: `<b>${item.name}</b>\n\n📝 ${item.desc}\n\n💰 Цена: <b>${item.price}</b>\n\n<i>Хотите узнать точную стоимость для вашей комнаты?</i>`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('📏 Записаться на замер', `order_item_${typeId}`)],
            [Markup.button.callback('🔙 К каталогу', 'catalog_start')]
        ])
    });
});

// КАТАЛОГ: Заказ конкретного вида
bot.action(/^order_item_(.+)$/, async (ctx) => {
    const typeId = ctx.match[1];
    const itemName = CATALOG[typeId]?.name || 'Потолок';

    await ctx.deleteMessage().catch(() => {});
    await ctx.scene.enter('ORDER_SCENE', { interest: itemName });
});

// Навигация
bot.action('back_home', (ctx) => {
    ctx.deleteMessage().catch(() => {});
    ctx.reply('Главное меню:', getMainMenu());
});

bot.action('info', (ctx) => {
    ctx.reply(
        `🏢 <b>Контакты Потолкоф</b>\n\n` +
        `📍 г. Улан-Удэ, ул. Примерная, 15\n` +
        `📞 +7 (983) 420-88-05\n` +
        `⏰ Пн-Пт: 9:00 - 18:00\n\n` +
        `Мы в соцсетях:\n📷 <a href="https://instagram.com/potolkoff_03">Instagram</a>`,
        {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }
    );
});

bot.action('portfolio', (ctx) => {
    ctx.reply(
        '📸 Посмотрите наши работы в Instagram: @potolkoff_03',
        Markup.inlineKeyboard([
            [Markup.button.url('Перейти в Инстаграм', 'https://instagram.com/potolkoff_03')]
        ])
    );
});

// 6. АДМИНКА (REPLY TO USER)
bot.on('text', async (ctx) => {
    // Если это реплай админа на заявку
    if (ctx.from.id == process.env.ADMIN_ID && ctx.message.reply_to_message) {
        const replyHeader = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

        if (!replyHeader) return;

        // Ищем ID клиента в теге #id123456
        const match = replyHeader.match(/#id(\d+)/);

        if (match) {
            const userId = match[1];

            try {
                await ctx.telegram.sendMessage(userId, `👨‍💼 <b>Сообщение от менеджера:</b>\n\n${ctx.message.text}`, {
                    parse_mode: 'HTML'
                });
                await ctx.reply('✅ Сообщение отправлено.');
            } catch (e) {
                await ctx.reply('❌ Ошибка отправки (клиент заблокировал бота).');
            }
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
