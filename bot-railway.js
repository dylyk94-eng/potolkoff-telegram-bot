require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const express = require('express');

// ============================================
// 1. КОНФИГУРАЦИЯ И ДАННЫЕ
// ============================================

// Каталог Потолков
const CEILINGS = {
    satin: {
        name: '✨ Сатиновые',
        price: 'от 2000 ₽/м²',
        desc: 'Эффект ткани, мягкое отражение света. Хит продаж для спален.',
        img: 'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg'
    },
    matte: {
        name: '☁️ Матовые',
        price: 'от 1800 ₽/м²',
        desc: 'Классика. Выглядит как идеально ровная побелка.',
        img: 'https://sk-potolok.ru/wp-content/uploads/2018/06/matoviy-natyazhnoy-potolok-foto-v-interere.jpg'
    },
    gloss: {
        name: '🪞 Глянцевые',
        price: 'от 1900 ₽/м²',
        desc: 'Визуально увеличивают пространство. Яркие, эффектные.',
        img: 'https://potolki-lider.ru/wp-content/uploads/2019/10/glyancevye-potolki-v-zale.jpg'
    },
    lines: {
        name: '🔦 Парящие линии',
        price: 'от 4500 ₽/м²',
        desc: 'Современный свет. LED-линии заменяют люстры.',
        img: 'https://ferico.by/images/new/osveshchenie/linii/linii-1.jpg'
    }
};

// Каталог Ремонта
const RENOVATION = {
    turnkey: {
        name: '🔑 Ремонт "Под ключ"',
        price: 'от 15.000 ₽/м²',
        desc: 'Полный цикл: демонтаж, электрика, отделка, уборка.',
        img: 'https://design-p.ru/wp-content/uploads/2018/10/remont-kvartiry-pod-klyuch-v-novostrojke.jpg'
    },
    whitebox: {
        name: '⬜ White Box',
        price: 'от 8.000 ₽/м²',
        desc: 'Предчистовая отделка. Стяжка и стены готовы к финишу.',
        img: 'https://www.fsk.ru/upload/iblock/88b/88b532729792010834199999.jpg'
    },
    bathroom: {
        name: '🛁 Санузел под ключ',
        price: 'от 80.000 ₽',
        desc: 'Плитка, разводка труб, установка сантехники.',
        img: 'https://sanuzel-remont.ru/wp-content/uploads/2020/05/remont-vannoy-komnaty-pod-klyuch-moskva.jpg'
    },
    design: {
        name: '🎨 Дизайн-проект',
        price: 'от 1.500 ₽/м²',
        desc: '3D-визуализация и чертежи для строителей.',
        img: 'https://arch-kon.ru/wp-content/uploads/2020/09/dizayn-proekt-kvartiry.jpg'
    }
};

// ============================================
// 2. СЦЕНА ЗАЯВКИ (ПОЛНОСТЬЮ НА КНОПКАХ)
// ============================================

const orderWizard = new Scenes.WizardScene(
    'ORDER_SCENE',
    // Шаг 1: Площадь (Кнопки)
    async (ctx) => {
        const interest = ctx.wizard.state.interest || 'Консультация';

        await ctx.reply(
            `🏗 Выбрана услуга: <b>${interest}</b>\n\n` +
            `📐 Укажите примерную площадь объекта:`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.keyboard([
                    ['До 30 м²', '30 - 60 м²'],
                    ['60 - 90 м²', 'Более 90 м²'],
                    ['🔙 Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Район (Кнопки)
    async (ctx) => {
        if (ctx.message?.text === '🔙 Отмена') return cancel(ctx);

        ctx.wizard.state.area = ctx.message.text;

        await ctx.reply(
            '📍 Выберите район города:',
            {
                reply_markup: Markup.keyboard([
                    ['Советский', 'Железнодорожный'],
                    ['Октябрьский', 'Пригород / ДНТ'],
                    ['🔙 Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 3: Телефон (Системная кнопка)
    async (ctx) => {
        if (ctx.message?.text === '🔙 Отмена') return cancel(ctx);

        ctx.wizard.state.district = ctx.message.text;

        await ctx.reply(
            '📞 Нажмите кнопку ниже, чтобы отправить номер телефона для связи:',
            {
                reply_markup: Markup.keyboard([
                    [Markup.button.contactRequest('📱 Отправить мой номер')],
                    ['🔙 Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 4: Финал
    async (ctx) => {
        if (ctx.message?.text === '🔙 Отмена') return cancel(ctx);

        // Получаем телефон (контакт или текст, если вдруг ввели)
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;

        // Валидация
        if (!ctx.message.contact && (!phone || phone.length < 5)) {
            await ctx.reply('⚠️ Пожалуйста, используйте кнопку "Отправить номер"!');
            return;
        }

        // Собираем данные
        const data = {
            interest: ctx.wizard.state.interest,
            area: ctx.wizard.state.area,
            district: ctx.wizard.state.district,
            phone: phone,
            user: ctx.from,
            source: ctx.session.source || 'Поиск',
            typeTag: ctx.wizard.state.type === 'renovation' ? '#ремонт' : '#потолки'
        };

        // Сообщение для админа/канала
        const adminMsg = `
🔥 <b>НОВАЯ ЗАЯВКА</b> ${data.typeTag}

👤 <b>Клиент:</b> <a href="tg://user?id=${data.user.id}">${data.user.first_name}</a>
📞 <b>Телефон:</b> <code>${data.phone}</code>
📌 <b>Интерес:</b> ${data.interest}
📐 <b>Площадь:</b> ${data.area}
📍 <b>Район:</b> ${data.district}
📢 <b>Источник:</b> ${data.source}

#id${data.user.id} #новая
        `;

        try {
            // Шлём в канал
            if (process.env.ORDER_CHANNEL_ID) {
                await ctx.telegram.sendMessage(process.env.ORDER_CHANNEL_ID, adminMsg, { parse_mode: 'HTML' });
            }

            // Ответ клиенту
            await ctx.reply(
                `✅ <b>Заявка принята!</b>\nМенеджер свяжется с вами в ближайшее время для уточнения деталей.`,
                {
                    parse_mode: 'HTML',
                    ...Markup.removeKeyboard()
                }
            );

            await ctx.reply('Главное меню:', getMainMenu());

        } catch (e) {
            console.error('Ошибка отправки:', e);
            await ctx.reply('⚠️ Произошла ошибка связи. Попробуйте позже.');
        }

        return ctx.scene.leave();
    }
);

// Функция отмены
const cancel = async (ctx) => {
    await ctx.reply('❌ Заявка отменена.', { ...Markup.removeKeyboard() });
    await ctx.reply('Главное меню:', getMainMenu());
    return ctx.scene.leave();
};

// ============================================
// 3. ИНИЦИАЛИЗАЦИЯ БОТА И СЕРВЕРА
// ============================================

const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([orderWizard]);
const app = express();
const PORT = process.env.PORT || 3000;

bot.use(session());
bot.use(stage.middleware());

// ============================================
// 4. МЕНЮ И ОБРАБОТЧИКИ
// ============================================

// Главная клавиатура
function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🏗 Ремонт квартир', 'menu_renovation'),
         Markup.button.callback('✨ Натяжные потолки', 'menu_ceilings')],
        [Markup.button.callback('ℹ️ Контакты', 'info'),
         Markup.button.callback('📸 Портфолио', 'portfolio')]
    ]);
}

// Старт
bot.start((ctx) => {
    ctx.session.source = ctx.startPayload || 'organic';

    ctx.replyWithPhoto(
        'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        {
            caption: `👋 <b>Привет, ${ctx.from.first_name}!</b>\n\n` +
            `Мы студия <b>Потолкоф</b>.\n` +
            `Делаем качественный ремонт и устанавливаем потолки в Улан-Удэ.\n\n` +
            `👇 <b>Выберите, что вас интересует:</b>`,
            parse_mode: 'HTML',
            ...getMainMenu()
        }
    );
});

// --- ВЕТКА: ПОТОЛКИ ---

bot.action('menu_ceilings', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(
        'https://via.placeholder.com/800x400?text=CEILINGS',
        {
            caption: '<b>✨ Каталог потолков</b>\n\nМонтаж от 1 дня. Гарантия 15 лет. Выберите тип:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback(CEILINGS.satin.name, 'view_c_satin'),
                 Markup.button.callback(CEILINGS.matte.name, 'view_c_matte')],
                [Markup.button.callback(CEILINGS.gloss.name, 'view_c_gloss'),
                 Markup.button.callback(CEILINGS.lines.name, 'view_c_lines')],
                [Markup.button.callback('🔙 В главное меню', 'back_home')]
            ])
        }
    );
});

// Просмотр карточки потолка
bot.action(/^view_c_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = CEILINGS[key];

    if (!item) return ctx.answerCbQuery('Раздел недоступен');

    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(item.img, {
        caption: `<b>${item.name}</b>\n\n` +
                `📄 ${item.desc}\n\n` +
                `💰 Цена: <b>${item.price}</b>\n\n` +
                `<i>Хотите записаться на бесплатный замер?</i>`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('📏 Вызвать замерщика', `ord_c_${key}`)],
            [Markup.button.callback('🔙 К потолкам', 'menu_ceilings')]
        ])
    });
});

// Запуск заявки на потолок
bot.action(/^ord_c_(.+)$/, (ctx) => {
    const key = ctx.match[1];
    ctx.deleteMessage().catch(() => {});
    ctx.scene.enter('ORDER_SCENE', { interest: CEILINGS[key].name, type: 'ceiling' });
});

// --- ВЕТКА: РЕМОНТ ---

bot.action('menu_renovation', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(
        'https://design-p.ru/wp-content/uploads/2018/10/remont-kvartiry-pod-klyuch-v-novostrojke.jpg',
        {
            caption: '<b>🏗 Ремонт и отделка</b>\n\nБерём на себя всё: от дизайна до клининга. Выберите услугу:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback(RENOVATION.turnkey.name, 'view_r_turnkey')],
                [Markup.button.callback(RENOVATION.whitebox.name, 'view_r_whitebox')],
                [Markup.button.callback(RENOVATION.bathroom.name, 'view_r_bathroom')],
                [Markup.button.callback(RENOVATION.design.name, 'view_r_design')],
                [Markup.button.callback('🔙 В главное меню', 'back_home')]
            ])
        }
    );
});

// Просмотр карточки ремонта
bot.action(/^view_r_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = RENOVATION[key];

    if (!item) return ctx.answerCbQuery('Раздел недоступен');

    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(item.img, {
        caption: `<b>${item.name}</b>\n\n` +
                `📄 ${item.desc}\n\n` +
                `💰 Ориентир: <b>${item.price}</b>\n\n` +
                `<i>Нужна смета или консультация прораба?</i>`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('📝 Оставить заявку', `ord_r_${key}`)],
            [Markup.button.callback('🔙 К ремонту', 'menu_renovation')]
        ])
    });
});

// Запуск заявки на ремонт
bot.action(/^ord_r_(.+)$/, (ctx) => {
    const key = ctx.match[1];
    ctx.deleteMessage().catch(() => {});
    ctx.scene.enter('ORDER_SCENE', { interest: RENOVATION[key].name, type: 'renovation' });
});

// --- ОБЩИЕ КНОПКИ ---

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
        `Мы работаем официально по договору. Гарантия на работы до 5 лет.`,
        {
            parse_mode: 'HTML'
        }
    );
});

bot.action('portfolio', (ctx) => {
    ctx.reply(
        '📸 Реальные примеры наших работ (До/После) смотрите в Instagram:',
        Markup.inlineKeyboard([
            [Markup.button.url('Перейти в Instagram', 'https://instagram.com/potolkoff_03')]
        ])
    );
});

// --- АДМИНКА (ОТВЕТ ПОЛЬЗОВАТЕЛЮ) ---

bot.on('text', async (ctx) => {
    // Проверяем, что пишет админ и это ответ на сообщение (Reply)
    if (ctx.from.id == process.env.ADMIN_ID && ctx.message.reply_to_message) {
        const originalText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

        if (!originalText) return;

        // Ищем ID клиента в хэштеге #id123456
        const match = originalText.match(/#id(\d+)/);

        if (match) {
            const userId = match[1];

            try {
                // Шлём ответ клиенту
                await ctx.telegram.sendMessage(userId, `👨‍💼 <b>Сообщение от менеджера:</b>\n\n${ctx.message.text}`, {
                    parse_mode: 'HTML'
                });
                await ctx.reply('✅ Ответ доставлен клиенту.');
            } catch (e) {
                await ctx.reply('❌ Не удалось доставить (клиент заблокировал бота).');
            }
        }
    }
});

// ============================================
// 5. ЗАПУСК СЕРВЕРА (WEBHOOK ДЛЯ RAILWAY)
// ============================================

app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => res.send('🤖 Potolkoff Construction Bot is Running!'));

const WEBHOOK_URL = process.env.WEBHOOK_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
    : null);

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    if (WEBHOOK_URL) {
        try {
            await bot.telegram.setWebhook(WEBHOOK_URL);
            console.log(`✅ Webhook set: ${WEBHOOK_URL}`);
        } catch (e) {
            console.error('❌ Failed to set webhook:', e);
        }
    } else {
        console.log('⚠️ No Webhook URL. If running locally, bot might not respond without polling.');
        // Для локального теста раскомментируй строку ниже:
        // bot.launch();
    }
});

// Graceful Stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
