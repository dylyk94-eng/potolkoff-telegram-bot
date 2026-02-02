require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const express = require('express');

// --- НАСТРОЙКИ И ДАННЫЕ ---
const SERVICES = {
    'satin': { name: '✨ Сатиновые', price: 2000, img: 'https://via.placeholder.com/600x400.png?text=Satin' },
    'matte': { name: '☁️ Матовые', price: 2000, img: 'https://via.placeholder.com/600x400.png?text=Matte' },
    'gloss': { name: '🪞 Глянцевые', price: 2000, img: 'https://via.placeholder.com/600x400.png?text=Gloss' },
    'fabric': { name: '🧵 Тканевые', price: 2500, img: 'https://via.placeholder.com/600x400.png?text=Fabric' },
    'multi': { name: '🏛️ Многоуровневые', price: 4500, img: 'https://via.placeholder.com/600x400.png?text=Multi' },
    'photo': { name: '🖼️ С фотопечатью', price: 3500, img: 'https://via.placeholder.com/600x400.png?text=Photo' }
};

// --- СЦЕНА КАЛЬКУЛЯТОРА ---
const calcWizard = new Scenes.WizardScene(
    'CALC_SCENE',
    // Шаг 1: Выбор типа
    async (ctx) => {
        await ctx.reply('🧮 <b>Шаг 1/3:</b> Выберите тип потолка:', {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('☁️ Матовый', 'type_matte'), Markup.button.callback('🪞 Глянцевый', 'type_gloss')],
                [Markup.button.callback('✨ Сатиновый', 'type_satin'), Markup.button.callback('🧵 Тканевый', 'type_fabric')],
                [Markup.button.callback('🔙 Отмена', 'cancel')]
            ]).resize()
        });
        return ctx.wizard.next();
    },
    // Шаг 2: Площадь
    async (ctx) => {
        if (ctx.callbackQuery) {
            if (ctx.callbackQuery.data === 'cancel') return leaveScene(ctx);
            const typeKey = ctx.callbackQuery.data.replace('type_', '');
            ctx.wizard.state.type = SERVICES[typeKey];
            await ctx.answerCbQuery();
        }
        await ctx.reply('📐 <b>Шаг 2/3:</b> Введите площадь помещения (м²):', { parse_mode: 'HTML' });
        return ctx.wizard.next();
    },
    // Шаг 3: Освещение
    async (ctx) => {
        const area = parseFloat(ctx.message?.text);
        if (isNaN(area)) return ctx.reply('⚠️ Пожалуйста, введите число (например: 15)');
        ctx.wizard.state.area = area;
        await ctx.reply('💡 <b>Шаг 3/3:</b> Планируется ли освещение?', {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🚫 Только люстра (0₽)', 'light_0')],
                [Markup.button.callback('🔅 До 6 точек (+3000₽)', 'light_3000')],
                [Markup.button.callback('🔆 Много света (+6000₽)', 'light_6000')]
            ])
        });
        return ctx.wizard.next();
    },
    // Финал: Расчет
    async (ctx) => {
        if (ctx.callbackQuery) {
            const extraCost = parseInt(ctx.callbackQuery.data.split('_')[1]);
            ctx.wizard.state.extraCost = extraCost;
            await ctx.answerCbQuery();
        }
        const { type, area, extraCost } = ctx.wizard.state;
        const basePrice = area * type.price;
        const totalMin = basePrice + extraCost;
        const totalMax = totalMin * 1.2; // +20% разброс

        // Сохраняем данные, если клиент захочет заказать сразу
        ctx.session.preCalc = {
            service: type.name,
            area: area,
            priceStr: `${totalMin} - ${totalMax} ₽`
        };

        await ctx.reply(
            `💰 <b>Расчет стоимости:</b>\n\n` +
            `🔹 Тип: ${type.name}\n` +
            `🔹 Площадь: ${area} м²\n` +
            `🔹 Доп. опции: ${extraCost > 0 ? 'Включены' : 'Базовые'}\n\n` +
            `💵 <b>Итого: ${totalMin} - ${totalMax} ₽</b>\n\n` +
            `<i>*Стоимость примерная. Точную скажет замерщик.</i>`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('🚀 Оформить заявку', 'start_order_from_calc')],
                    [Markup.button.callback('🔄 Новый расчет', 'restart_calc')],
                    [Markup.button.callback('🔙 В меню', 'exit_calc')]
                ])
            }
        );
        return ctx.wizard.leave();
    }
);

// --- СЦЕНА ЗАЯВКИ (ORDER) ---
const orderWizard = new Scenes.WizardScene(
    'ORDER_SCENE',
    // Шаг 1: Выбор услуги (если не выбрана ранее)
    async (ctx) => {
        // Если перешли из калькулятора, пропускаем этот шаг
        if (ctx.session.preCalc) {
            ctx.wizard.state.formData = { ...ctx.session.preCalc };
            await ctx.reply(`✅ Выбрано: ${ctx.wizard.state.formData.service}, ${ctx.wizard.state.formData.area} м²`);
            return ctx.wizard.selectStep(2); // Прыгаем к адресу
        }
        ctx.wizard.state.formData = {};
        await ctx.reply('🛠 Что будем делать?', {
            reply_markup: Markup.keyboard([
                ['✨ Натяжные потолки', '🔧 Ремонт под ключ'],
                ['🔙 Отмена']
            ]).oneTime().resize()
        });
        return ctx.wizard.next();
    },
    // Шаг 2: Площадь (если не из калькулятора)
    async (ctx) => {
        if (ctx.message?.text === '🔙 Отмена') return leaveScene(ctx);
        if (!ctx.wizard.state.formData.service) {
            ctx.wizard.state.formData.service = ctx.message.text;
        }
        if (ctx.wizard.state.formData.area) return ctx.wizard.next();
        await ctx.reply('📐 Укажите примерную площадь (м²):');
        return ctx.wizard.next();
    },
    // Шаг 3: Адрес
    async (ctx) => {
        if (!ctx.wizard.state.formData.area) {
            const area = parseFloat(ctx.message.text);
            if (isNaN(area)) return ctx.reply('Введите число.');
            ctx.wizard.state.formData.area = area;
        }
        await ctx.reply('🏠 Напишите адрес для выезда замерщика (Улица, дом):');
        return ctx.wizard.next();
    },
    // Шаг 4: Контакт (Кнопка)
    async (ctx) => {
        ctx.wizard.state.formData.address = ctx.message.text;
        await ctx.reply('📞 Нажмите кнопку ниже, чтобы отправить телефон:', {
            reply_markup: Markup.keyboard([
                [Markup.button.contactRequest('📱 Отправить мой номер')],
                ['Пропустить (введу вручную)']
            ]).oneTime().resize()
        });
        return ctx.wizard.next();
    },
    // Шаг 5: Финал и отправка
    async (ctx) => {
        let phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        ctx.wizard.state.formData.phone = phone;
        ctx.wizard.state.formData.source = ctx.session.source || 'organic'; // UTM метка

        const data = ctx.wizard.state.formData;
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : 'Скрыт';

        // 1. Сообщение Админу/В канал
        const adminMsg = `
🆕 <b>НОВАЯ ЗАЯВКА</b>

👤 <b>Клиент:</b> <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> (${username})
📞 <b>Телефон:</b> <code>${data.phone}</code>
🛠 <b>Услуга:</b> ${data.service}
📐 <b>Площадь:</b> ${data.area} м²
🏠 <b>Адрес:</b> ${data.address}
💰 <b>Цена (из бота):</b> ${data.priceStr || 'Не рассчитывал'}
📢 <b>Источник:</b> ${data.source}

#id${userId} #новая
        `;

        try {
            // Отправляем админу (если указан ID)
            if (process.env.ADMIN_ID) {
                await ctx.telegram.sendMessage(process.env.ADMIN_ID, adminMsg, { parse_mode: 'HTML' });
            }
            // Отправляем в канал (если указан ID)
            if (process.env.ORDER_CHANNEL_ID) {
                await ctx.telegram.sendMessage(process.env.ORDER_CHANNEL_ID, adminMsg, { parse_mode: 'HTML' });
            }

            await ctx.reply('✅ <b>Заявка принята!</b>\nМенеджер свяжется с вами в течение 15 минут.', {
                parse_mode: 'HTML',
                reply_markup: Markup.removeKeyboard()
            });
            // Отправляем главное меню
            await ctx.reply('Чем еще могу помочь?', getMainMenu());
        } catch (e) {
            console.error(e);
            await ctx.reply('⚠️ Ошибка соединения. Попробуйте позже.');
        }
        // Очищаем пре-кальк
        ctx.session.preCalc = null;
        return ctx.wizard.leave();
    }
);

// Вспомогательная функция выхода
const leaveScene = async (ctx) => {
    await ctx.reply('❌ Действие отменено', getMainMenu());
    return ctx.scene.leave();
};

// --- ИНИЦИАЛИЗАЦИЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([calcWizard, orderWizard]);
const app = express();
const PORT = process.env.PORT || 3000;

bot.use(session());
bot.use(stage.middleware());

// --- ГЛАВНОЕ МЕНЮ (Клавиатура) ---
function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🎨 Каталог потолков', 'catalog_start')],
        [Markup.button.callback('🧮 Калькулятор', 'start_calc'), Markup.button.callback('📝 Заказать замер', 'start_order')],
        [Markup.button.callback('ℹ️ Контакты', 'info'), Markup.button.callback('💼 Портфолио', 'portfolio')]
    ]);
}

// --- ОБРАБОТЧИКИ ---

// 1. Старт и UTM
bot.start((ctx) => {
    // Сохраняем источник (utm), если есть
    const payload = ctx.startPayload;
    if (payload) ctx.session.source = payload;

    ctx.replyWithHTML(
        `👋 Привет, <b>${ctx.from.first_name}</b>!\n\n` +
        `Я бот компании <b>Потолкоф</b> 🐾\n` +
        `Помогу выбрать потолок, рассчитать цену и вызвать мастера.`,
        getMainMenu()
    );
});

// 2. Каталог (С картинкой)
bot.action('catalog_start', async (ctx) => {
    // ЗАМЕНИ URL НА СВОИ FILE_ID (загрузи фото боту и возьми id)
    await ctx.replyWithPhoto(
        'https://via.placeholder.com/800x400.png?text=POTOLKOFF+CATALOG',
        {
            caption: '<b>📂 Каталог решений</b>\nВыберите категорию:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✨ Сатиновые', 'cat_satin'), Markup.button.callback('☁️ Матовые', 'cat_matte')],
                [Markup.button.callback('🪞 Глянцевые', 'cat_gloss'), Markup.button.callback('🧵 Тканевые', 'cat_fabric')],
                [Markup.button.callback('🔙 В меню', 'back_menu')]
            ])
        }
    );
});

// Обработка кнопок каталога (динамически)
Object.keys(SERVICES).forEach(key => {
    bot.action(`cat_${key}`, async (ctx) => {
        const item = SERVICES[key];
        await ctx.replyWithPhoto(item.img, {
            caption: `<b>${item.name}</b>\n\n💵 Цена: от ${item.price} ₽/м²\n\n✅ Идеально ровная поверхность\n✅ Монтаж за 3 часа\n✅ Гарантия 15 лет`,
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🧮 Рассчитать этот вид', `calc_with_${key}`)],
                [Markup.button.callback('🔙 К каталогу', 'catalog_start')]
            ])
        });
    });
});

// 3. Запуск сцен
bot.action('start_calc', (ctx) => ctx.scene.enter('CALC_SCENE'));
bot.action('restart_calc', (ctx) => ctx.scene.enter('CALC_SCENE'));
bot.action('start_order', (ctx) => ctx.scene.enter('ORDER_SCENE'));
bot.action('start_order_from_calc', (ctx) => ctx.scene.enter('ORDER_SCENE'));
bot.action('back_menu', (ctx) => {
    ctx.deleteMessage(); // Удаляем старое
    ctx.reply('Главное меню:', getMainMenu());
});

// 4. Контакты
bot.action('info', (ctx) => {
    ctx.replyWithHTML(
        `<b>📞 Контакты Потолкоф</b>\n\n` +
        `📱 Телефон: +7 (983) 420-88-05\n` +
        `💬 Telegram: @potolkoff2024\n` +
        `🌐 VK: vk.com/potolkoff03\n` +
        `📸 Instagram: @potolkoff_03\n\n` +
        `🕒 Режим работы:\nПн-Пт: 9:00 - 18:00\nСб-Вс: выходной\n` +
        `📍 Улан-Удэ и Бурятия`,
        Markup.inlineKeyboard([
            [Markup.button.url('💬 Написать в Telegram', 'https://t.me/potolkoff2024')],
            [Markup.button.callback('🔙 В меню', 'back_menu')]
        ])
    );
});

// 5. Портфолио
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
            [Markup.button.url('💬 Отзывы', 'https://vk.com/topic-172808215_48667766')],
            [Markup.button.callback('🔙 В меню', 'back_menu')]
        ])
    );
});

// 6. Админ-функция: Ответ пользователю (Reply)
bot.on('text', async (ctx) => {
    // Проверка: сообщение от админа и это ответ (reply)
    if (ctx.from.id == process.env.ADMIN_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
        if (!replyText) return;

        // Ищем #id123456 в тексте оригинального сообщения
        const match = replyText.match(/#id(\d+)/);
        if (match) {
            const userId = match[1];
            try {
                await ctx.telegram.sendMessage(userId, `👨‍💼 <b>Сообщение от менеджера:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
                await ctx.reply('✅ Сообщение отправлено клиенту.');
            } catch (e) {
                await ctx.reply('❌ Не удалось отправить. Возможно, бот заблокирован.');
            }
        } else {
            await ctx.reply('⚠️ Не нашел ID пользователя в сообщении (ищу тег #id...)');
        }
    }
});

// 7. Калькулятор из каталога (добавим для полноты)
bot.action(/^calc_with_(.+)$/, async (ctx) => {
    const typeKey = ctx.match[1];
    const service = SERVICES[typeKey];

    // Сохраняем выбор и запускаем калькулятор с 2 шага
    ctx.session.preCalc = { service: service.name };
    await ctx.answerCbQuery();
    await ctx.reply(`✅ Выбрано: ${service.name}`);
    await ctx.reply('📐 <b>Шаг 2/3:</b> Введите площадь помещения (м²):', { parse_mode: 'HTML' });
    ctx.scene.enter('CALC_SCENE');
});

// Exit from calculator
bot.action('exit_calc', (ctx) => {
    ctx.session.preCalc = null;
    ctx.reply('Главное меню:', getMainMenu());
});

// ============================================
// Webhook setup for Railway
// ============================================

// Express middleware for body parsing
app.use(express.json());

// Webhook endpoint
app.use(bot.webhookCallback('/webhook'));

// Health check endpoint
app.get('/', (req, res) => {
    res.send('🤖 Potolkoff Telegram Bot is running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', bot: 'active' });
});

// Get Railway URL
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` + '/webhook'
    : null;

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    // Set webhook if WEBHOOK_URL is provided
    if (WEBHOOK_URL) {
        try {
            await bot.telegram.setWebhook(WEBHOOK_URL);
            console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
        } catch (error) {
            console.error('❌ Error setting webhook:', error);
        }
    } else {
        console.log('⚠️  WEBHOOK_URL not set, webhook not configured');
        console.log('💡 Set WEBHOOK_URL or RAILWAY_PUBLIC_DOMAIN environment variable');
    }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
