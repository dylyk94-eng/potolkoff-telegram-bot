require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const express = require('express');

// ============================================
// 1. КОНФИГУРАЦИЯ И ДАННЫЕ
// ============================================

// Каталог Потолков (расширенный)
const CEILINGS = {
    satin: {
        name: '✨ Сатиновые',
        price: 'от 2000 ₽/м²',
        priceNum: 2000,
        desc: 'Эффект шёлковой ткани с мягким отражением света. Идеально для спален и гостиных.',
        img: 'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        features: ['⏱️ Монтаж за 4 часа', '🔧 Гарантия 15 лет', '🎁 2 светильника в подарок'],
        popular: true,
        views: 187
    },
    matte: {
        name: '☁️ Матовые',
        price: 'от 1800 ₽/м²',
        priceNum: 1800,
        desc: 'Классический вариант. Выглядит как идеально ровная побелка без отражений.',
        img: 'https://sk-potolok.ru/wp-content/uploads/2018/06/matoviy-natyazhnoy-potolok-foto-v-interere.jpg',
        features: ['⏱️ Монтаж за 3 часа', '🔧 Гарантия 15 лет', '💰 Самый доступный'],
        popular: false,
        views: 143
    },
    gloss: {
        name: '🪞 Глянцевые',
        price: 'от 1900 ₽/м²',
        priceNum: 1900,
        desc: 'Зеркальный эффект визуально увеличивает пространство. Яркие, эффектные.',
        img: 'https://potolki-lider.ru/wp-content/uploads/2019/10/glyancevye-potolki-v-zale.jpg',
        features: ['⏱️ Монтаж за 4 часа', '🔧 Гарантия 15 лет', '📏 +30% к высоте визуально'],
        popular: false,
        views: 156
    },
    lines: {
        name: '🔦 Парящие линии',
        price: 'от 4500 ₽/м²',
        priceNum: 4500,
        desc: 'Современное решение. LED-линии создают эффект парения и заменяют люстры.',
        img: 'https://ferico.by/images/new/osveshchenie/linii/linii-1.jpg',
        features: ['⏱️ Монтаж за 1 день', '💡 Экономия на люстрах', '🎨 Любой цвет свечения'],
        popular: false,
        views: 98
    }
};

// Каталог Ремонта (расширенный)
const RENOVATION = {
    turnkey: {
        name: '🔑 Ремонт "Под ключ"',
        price: 'от 15.000 ₽/м²',
        priceNum: 15000,
        desc: 'Полный цикл работ: демонтаж, электрика, сантехника, отделка, клининг.',
        img: 'https://design-p.ru/wp-content/uploads/2018/10/remont-kvartiry-pod-klyuch-v-novostrojke.jpg',
        features: ['📋 Договор с фиксацией сроков', '🏗 Средний срок: 28 дней', '🧹 Уборка включена'],
        popular: true,
        views: 234
    },
    whitebox: {
        name: '⬜ White Box',
        price: 'от 8.000 ₽/м²',
        priceNum: 8000,
        desc: 'Предчистовая отделка. Стяжка и стены готовы к финишу.',
        img: 'https://www.fsk.ru/upload/iblock/88b/88b532729792010834199999.jpg',
        features: ['⚡️ Быстрый старт отделки', '💰 Экономия до 40%', '🏗 Срок: 14-21 день'],
        popular: false,
        views: 167
    },
    bathroom: {
        name: '🛁 Санузел под ключ',
        price: 'от 80.000 ₽',
        priceNum: 80000,
        desc: 'Плитка, гидроизоляция, разводка труб, установка сантехники.',
        img: 'https://sanuzel-remont.ru/wp-content/uploads/2020/05/remont-vannoy-komnaty-pod-klyuch-moskva.jpg',
        features: ['🔧 Гарантия на гидроизоляцию', '🚿 Монтаж сантехниками', '🏗 Срок: 7-10 дней'],
        popular: false,
        views: 201
    },
    design: {
        name: '🎨 Дизайн-проект',
        price: 'от 1.500 ₽/м²',
        priceNum: 1500,
        desc: '3D-визуализация, планировки, подбор материалов, чертежи для строителей.',
        img: 'https://arch-kon.ru/wp-content/uploads/2020/09/dizayn-proekt-kvartiry.jpg',
        features: ['🖼️ До 10 визуализаций', '📐 Все чертежи', '🎁 Бесплатно при ремонте'],
        popular: false,
        views: 189
    }
};

// Отзывы
const REVIEWS = [
    {
        name: 'Мария С.',
        text: 'Делали сатиновые потолки в 3-комнатной. Бригада приехала вовремя, работали аккуратно, убрали за собой. Результат превзошёл ожидания! 🔥',
        rating: '⭐️⭐️⭐️⭐️⭐️',
        date: '15 янв 2026',
        service: 'Натяжные потолки'
    },
    {
        name: 'Дмитрий К.',
        text: 'Ремонт под ключ за 28 дней ровно, как обещали. Все по договору, без доплат и сюрпризов. Очень рекомендую!',
        rating: '⭐️⭐️⭐️⭐️⭐️',
        date: '10 янв 2026',
        service: 'Ремонт под ключ'
    },
    {
        name: 'Ольга В.',
        text: 'Сделали санузел под ключ. Плитка положена идеально, гидроизоляция — на совесть. Спасибо мастерам!',
        rating: '⭐️⭐️⭐️⭐️⭐️',
        date: '8 янв 2026',
        service: 'Санузел'
    },
    {
        name: 'Алексей П.',
        text: 'Заказывали глянцевые потолки. Работа заняла 5 часов, комната преобразилась. Цена соответствует качеству.',
        rating: '⭐️⭐️⭐️⭐️',
        date: '3 янв 2026',
        service: 'Натяжные потолки'
    }
];

// ============================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Получить время до конца акции (до полуночи)
function getPromoTimeLeft() {
    const now = new Date();
    const hoursLeft = 23 - now.getHours();
    const minutesLeft = 59 - now.getMinutes();
    return `${hoursLeft}ч ${minutesLeft}мин`;
}

// Быстрый расчёт стоимости
function quickCalc(pricePerM2, area) {
    const numArea = parseInt(area);
    if (isNaN(numArea)) return 'Рассчитаем индивидуально';
    return `≈ ${(pricePerM2 * numArea).toLocaleString('ru')} ₽`;
}

// ============================================
// 3. СЦЕНА ЗАЯВКИ (УЛУЧШЕННАЯ - 3 ШАГА)
// ============================================

const orderWizard = new Scenes.WizardScene(
    'ORDER_SCENE',
    // Шаг 1: Площадь с прогрессом
    async (ctx) => {
        const interest = ctx.wizard.state.interest || 'Консультация';
        const priceHint = ctx.wizard.state.priceNum ? `\n<i>Примерная стоимость будет рассчитана автоматически</i>` : '';

        await ctx.reply(
            `🎯 <b>Шаг 1 из 3</b> ▓▓░░\n\n` +
            `Вы выбрали: <b>${interest}</b>\n\n` +
            `📐 <b>Какая площадь объекта?</b>${priceHint}`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.keyboard([
                    ['До 30 м²', '30-60 м²'],
                    ['60-90 м²', '90+ м²'],
                    ['Не знаю точно'],
                    ['❌ Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Контакт сразу!
    async (ctx) => {
        if (ctx.message?.text === '❌ Отмена') return cancel(ctx);

        ctx.wizard.state.area = ctx.message.text;

        // Показываем примерную стоимость
        let costEstimate = '';
        if (ctx.wizard.state.priceNum) {
            const areaMatch = ctx.message.text.match(/\d+/);
            if (areaMatch) {
                const estimate = ctx.wizard.state.priceNum * parseInt(areaMatch[0]);
                costEstimate = `\n💰 <b>Примерная стоимость: ${estimate.toLocaleString('ru')} ₽</b>\n`;
            }
        }

        await ctx.reply(
            `🎯 <b>Шаг 2 из 3</b> ▓▓▓░░\n\n` +
            `📐 Площадь: ${ctx.wizard.state.area}${costEstimate}\n\n` +
            `📞 <b>Как с вами связаться?</b>\n` +
            `<i>Менеджер перезвонит в течение 5 минут и уточнит детали</i>`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.keyboard([
                    [Markup.button.contactRequest('📱 Поделиться номером')],
                    ['Ввести номер вручную'],
                    ['❌ Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Шаг 2.5: Если ввод вручную
    async (ctx) => {
        if (ctx.message?.text === '❌ Отмена') return cancel(ctx);

        // Если отправлен контакт - сохраняем и идём дальше
        if (ctx.message.contact) {
            ctx.wizard.state.phone = ctx.message.contact.phone_number;
            return ctx.wizard.selectStep(3);
        }

        // Если текст "Ввести номер вручную" - просим ввести
        if (ctx.message.text === 'Ввести номер вручную') {
            await ctx.reply(
                '📱 Введите ваш номер телефона:\n' +
                '<i>Формат: +79991234567 или 89991234567</i>',
                {
                    parse_mode: 'HTML',
                    reply_markup: Markup.keyboard([['❌ Отмена']]).oneTime().resize()
                }
            );
            return;
        }

        // Валидация введённого номера
        const phone = ctx.message.text.replace(/[\s\-\(\)]/g, '');
        if (!/^[\+]?[78]\d{10}$/.test(phone)) {
            await ctx.reply('⚠️ Некорректный формат номера.\nПопробуйте ещё раз или используйте кнопку "Поделиться"');
            return;
        }

        ctx.wizard.state.phone = phone;
        return ctx.wizard.next();
    },
    // Шаг 3: Район
    async (ctx) => {
        if (ctx.message?.text === '❌ Отмена') return cancel(ctx);

        await ctx.reply(
            `🎯 <b>Шаг 3 из 3</b> ▓▓▓▓▓\n\n` +
            `📍 <b>В каком районе находится объект?</b>\n` +
            `<i>Это поможет выбрать ближайшую свободную бригаду</i>`,
            {
                parse_mode: 'HTML',
                reply_markup: Markup.keyboard([
                    ['Советский', 'Железнодорожный'],
                    ['Октябрьский', 'Пригород / ДНТ'],
                    ['Уточню по телефону'],
                    ['❌ Отмена']
                ]).oneTime().resize()
            }
        );
        return ctx.wizard.next();
    },
    // Финал: Красивое подтверждение
    async (ctx) => {
        if (ctx.message?.text === '❌ Отмена') return cancel(ctx);

        ctx.wizard.state.district = ctx.message.text;

        const data = {
            interest: ctx.wizard.state.interest,
            area: ctx.wizard.state.area,
            phone: ctx.wizard.state.phone,
            district: ctx.wizard.state.district,
            user: ctx.from,
            source: ctx.session.source || 'organic',
            typeTag: ctx.wizard.state.type === 'renovation' ? '#ремонт' : '#потолки',
            timestamp: new Date().toLocaleString('ru')
        };

        // Генерируем номер заявки
        const orderNum = Math.floor(Math.random() * 9000) + 1000;

        // Сообщение для админа/канала
        const adminMsg = `
🔥 <b>НОВАЯ ЗАЯВКА #${orderNum}</b> ${data.typeTag}
━━━━━━━━━━━━━━━━━━━━
👤 <b>Клиент:</b> <a href="tg://user?id=${data.user.id}">${data.user.first_name}</a> ${data.user.username ? `(@${data.user.username})` : ''}
📞 <b>Телефон:</b> <code>${data.phone}</code>
📦 <b>Услуга:</b> ${data.interest}
📐 <b>Площадь:</b> ${data.area}
📍 <b>Район:</b> ${data.district}
📢 <b>Источник:</b> ${data.source}
⏰ <b>Время:</b> ${data.timestamp}
━━━━━━━━━━━━━━━━━━━━
<b>🎯 ПРИОРИТЕТ: Перезвонить в течение 5 минут!</b>

#id${data.user.id} #новая #горячая
        `;

        try {
            // Отправляем в канал заявок
            if (process.env.ORDER_CHANNEL_ID) {
                await ctx.telegram.sendMessage(
                    process.env.ORDER_CHANNEL_ID,
                    adminMsg,
                    { parse_mode: 'HTML' }
                );
            }

            // Красивое подтверждение клиенту
            await ctx.replyWithPhoto(
                'https://i.imgur.com/8XyZQjM.png', // Замени на свою картинку успеха
                {
                    caption: `✅ <b>Заявка №${orderNum} принята!</b>\n\n` +
                            `🎉 Отлично, ${ctx.from.first_name}!\n\n` +
                            `Менеджер <b>Анна</b> уже набирает ваш номер.\n` +
                            `🏱 Обычно перезваниваем за 3-5 минут.\n\n` +
                            `🎁 <b>Ваши бонусы при заказе:</b>\n` +
                            `✅ Бесплатный выезд замерщика\n` +
                            `✅ Дизайн-проект в подарок\n` +
                            `✅ Скидка 5% при заказе сегодня\n` +
                            `✅ Рассрочка 0% на 6 месяцев\n` +
                            `<i>Если вдруг не дозвонимся — напишем в Telegram</i>`,
                    parse_mode: 'HTML',
                    ...Markup.removeKeyboard()
                }
            );

            // Пауза, затем доп. информация
            setTimeout(async () => {
                await ctx.reply(
                    `💬 <b>Пока ожидаете звонка, можете:</b>\n\n` +
                    `📸 Посмотреть фото наших работ\n` +
                    `⭐️ Почитать отзывы клиентов (4.9/5)\n` +
                    `🎁 Узнать об акциях месяца\n` +
                    `🧮 Рассчитать точную стоимость`,
                    {
                        parse_mode: 'HTML',
                        ...getMainMenu()
                    }
                );
            }, 4000);

        } catch (e) {
            console.error('❌ Ошибка отправки заявки:', e);
            await ctx.reply(
                '⚠️ Произошёл технический сбой, но ваша заявка сохранена!\n\n' +
                'Если не перезвоним — напишите напрямую:\n' +
                '👤 @potolkoff_manager\n' +
                '📞 +7 (983) 420-88-05',
                {
                    ...Markup.removeKeyboard()
                }
            );
        }

        return ctx.scene.leave();
    }
);

// Функция отмены
const cancel = async (ctx) => {
    await ctx.reply(
        '❌ <b>Заявка отменена</b>\nЕсли передумаете — мы всегда на связи! 😊',
        {
            parse_mode: 'HTML',
            ...Markup.removeKeyboard()
        }
    );
    setTimeout(() => {
        ctx.reply('Главное меню:', getMainMenu());
    }, 1000);
    return ctx.scene.leave();
};

// ============================================
// 4. ИНИЦИАЛИЗАЦИЯ БОТА И СЕРВЕРА
// ============================================

const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([orderWizard]);
const app = express();
const PORT = process.env.PORT || 3000;

bot.use(session());
bot.use(stage.middleware());

// ============================================
// 5. ГЛАВНОЕ МЕНЮ И НАВИГАЦИЯ
// ============================================

// Главное меню (улучшенное)
function getMainMenu() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('✨ Потолки от 1800₽', 'menu_ceilings'),
            Markup.button.callback('🏗 Ремонт от 8000₽', 'menu_renovation')
        ],
        [
            Markup.button.callback('📸 Наши работы (120+ фото)', 'portfolio'),
            Markup.button.callback('⭐️ Отзывы (4.9/5)', 'reviews')
        ],
        [
            Markup.button.callback('🎁 Акции месяца', 'promo'),
            Markup.button.callback('🧮 Калькулятор', 'calculator')
        ],
        [
            Markup.button.callback('📞 Контакты и адрес', 'info')
        ]
    ]);
}

// Команда /start (красивое приветствие)
bot.start(async (ctx) => {
    ctx.session.source = ctx.startPayload || 'organic';

    await ctx.replyWithPhoto(
        'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        {
            caption: `👋 <b>Привет, ${ctx.from.first_name}!</b>\n\n` +
                    `Мы — студия <b>Потолкоф</b>.\n` +
                    `Делаем качественный ремонт и устанавливаем натяжные потолки в Улан-Удэ с 2015 года.\n\n` +
                    `<b>Почему выбирают нас:</b>\n` +
                    `✅ Более 2000 довольных клиентов\n` +
                    `✅ Гарантия 15 лет на потолки / 5 лет на ремонт\n` +
                    `✅ Работаем по договору с фиксацией цены\n` +
                    `✅ Средний срок ремонта: 21 день\n` +
                    `✅ Рассрочка 0% до 12 месяцев\n\n` +
                    `🎁 <b>Акция сегодня:</b> Замер и дизайн-проект БЕСПЛАТНО!\n` +
                    `⏰ До конца акции: <b>${getPromoTimeLeft()}</b>\n\n` +
                    `👇 <b>Что вас интересует?</b>`,
            parse_mode: 'HTML',
            ...getMainMenu()
        }
    );
});

// Возврат в главное меню
bot.action('back_home', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});
    await ctx.replyWithPhoto(
        'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        {
            caption: '<b>🏠 Главное меню</b>\n\nВыберите интересующий раздел:',
            parse_mode: 'HTML',
            ...getMainMenu()
        }
    );
});

// ============================================
// 6. РАЗДЕЛ: НАТЯЖНЫЕ ПОТОЛКИ
// ============================================

bot.action('menu_ceilings', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(
        'https://potolok-art.ru/wp-content/uploads/2/6/5/2658826500e5728646f9055819074092.jpeg',
        {
            caption: '<b>✨ НАТЯЖНЫЕ ПОТОЛКИ</b>\n\n' +
                     '🎯 <b>Быстрый расчёт стоимости:</b>\n' +
                     '• 20 м² = от 36.000₽\n' +
                     '• 40 м² = от 72.000₽\n' +
                     '• 60 м² = от 108.000₽\n' +
                     '⚡️ Монтаж за 1 день\n' +
                     '🔧 Гарантия 15 лет\n' +
                     '🎁 2 встроенных светильника в подарок\n\n' +
                     '🎁 <b>Акция сегодня:</b> 2 встроенных светильника в подарок\n' +
                     `⏰ Акция действует: <b>${getPromoTimeLeft()}</b>\n\n` +
                     'Выберите тип потолка:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback('✨ Сатин (ХИТ!) 2000₽/м²', 'view_c_satin'),
                    Markup.button.callback('☁️ Матовый 1800₽/м²', 'view_c_matte')
                ],
                [
                    Markup.button.callback('🪞 Глянец 1900₽/м²', 'view_c_gloss'),
                    Markup.button.callback('🔦 Парящие линии 4500₽/м²', 'view_c_lines')
                ],
                [
                    Markup.button.callback('🧮 Калькулятор', 'calculator'),
                    Markup.button.callback('📸 Фото работ', 'portfolio_ceilings')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        }
    );
});

// Карточка потолка (детальная)
bot.action(/^view_c_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = CEILINGS[key];

    if (!item) return ctx.answerCbQuery('⚠️ Раздел недоступен');

    const badge = item.popular ? '🔥 ХИТ ПРОДАЖ ' : '';

    await ctx.editMessageMedia({
        type: 'photo',
        media: item.img,
        caption: `${badge}<b>${item.name}</b>\n\n` +
                `📄 ${item.desc}\n\n` +
                `💰 <b>Цена: ${item.price}</b>\n\n` +
                `<b>Что входит в стоимость:</b>\n` +
                item.features.map(f => `${f}`).join('\n') +
                `\n\n👥 Выбрали <b>${item.views}</b> клиентов за месяц\n\n` +
                `🎁 <b>Акция сегодня:</b> 2 встроенных светильника в подарок\n` +
                `🎁 Бесплатный выезд замерщика\n` +
                `🎁 Скидка 5% при заказе сегодня\n` +
                `⏰ До конца акции: <b>${getPromoTimeLeft()}</b>\n\n` +
                `<i>Хотите записаться на бесплатный замер?</i>`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.callback('🎁 Заказать со скидкой', `ord_c_${key}`)
            ],
            [
                Markup.button.callback('📸 Ещё фото', `gallery_c_${key}`),
                Markup.button.callback('💬 Отзывы', `reviews_c_${key}`)
            ],
            [
                Markup.button.callback('🔙 Все потолки', 'menu_ceilings')
            ]
        ])
    });
});

// Запуск заявки на потолок
bot.action(/^ord_c_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    await ctx.deleteMessage().catch(() => {});
    await ctx.scene.enter('ORDER_SCENE', {
        interest: CEILINGS[key].name,
        type: 'ceiling',
        priceNum: CEILINGS[key].priceNum
    });
});

// Галерея (заглушка, можно расширить)
bot.action(/^gallery_c_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('📸 Галерея в разработке. Смотрите в Instagram!');
});

// Отзывы по типу потолка
bot.action(/^reviews_c_(.+)$/, async (ctx) => {
    const ceilingReviews = REVIEWS.filter(r => r.service === 'Натяжные потолки');

    let reviewText = '<b>⭐️ ОТЗЫВЫ О НАТЯЖНЫХ ПОТОЛКАХ</b>\n\n';

    ceilingReviews.forEach(r => {
        reviewText += `${r.rating} <b>${r.name}</b> — ${r.date}\n"${r.text}"\n━━━━━━━━━\n`;
    });

    reviewText += `📊 Средняя оценка: <b>4.9/5</b> (${ceilingReviews.length} отзывов)`;

    await ctx.editMessageCaption(reviewText, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.url('Все отзывы на Яндекс.Карты', 'https://yandex.ru/maps/')
            ],
            [
                Markup.button.callback('🔙 Назад', 'menu_ceilings')
            ]
        ])
    });
});

// ============================================
// 7. РАЗДЕЛ: РЕМОНТ
// ============================================

bot.action('menu_renovation', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});

    await ctx.replyWithPhoto(
        'https://design-p.ru/wp-content/uploads/2018/10/remont-kvartiry-pod-klyuch-v-novostrojke.jpg',
        {
            caption: '<b>🏗 РЕМОНТ И ОТДЕЛКА</b>\n\n' +
                     '🎯 <b>Ориентиры по стоимости:</b>\n' +
                     '• 1-комн (35 м²) = от 525.000₽\n' +
                     '• 2-комн (55 м²) = от 825.000₽\n' +
                     '• 3-комн (75 м²) = от 1.125.000₽\n\n' +
                     '📋 Работаем по договору с фиксацией сроков\n' +
                     '🏗 Средний срок: 21-28 дней\n' +
                     '🧹 Клининг после ремонта включён\n\n' +
                     `🎁 <b>Акция:</b> Дизайн-проект в подарок (${getPromoTimeLeft()})\n\n` +
                     'Выберите услугу:',
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔑 Под ключ (ХИТ!) 15.000₽/м²', 'view_r_turnkey'),
                    Markup.button.callback('⬜ White Box 8.000₽/м²', 'view_r_whitebox')
                ],
                [
                    Markup.button.callback('🛁 Санузел от 80.000₽', 'view_r_bathroom'),
                    Markup.button.callback('🎨 Дизайн-проект 1.500₽/м²', 'view_r_design')
                ],
                [
                    Markup.button.callback('📸 Портфолио', 'portfolio_renovation'),
                    Markup.button.callback('⭐️ Отзывы', 'reviews_renovation')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        }
    );
});

// Карточка услуги ремонта
bot.action(/^view_r_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = RENOVATION[key];

    if (!item) return ctx.answerCbQuery('⚠️ Раздел недоступен');

    const badge = item.popular ? '🔥 САМЫЙ ПОПУЛЯРНЫЙ ' : '';

    await ctx.editMessageMedia({
        type: 'photo',
        media: item.img,
        caption: `${badge}<b>${item.name}</b>\n\n` +
                `📄 ${item.desc}\n\n` +
                `💰 <b>Стоимость: ${item.price}</b>\n\n` +
                `<b>Что входит:</b>\n` +
                item.features.map(f => `${f}`).join('\n') +
                `\n\n👥 ${item.views} клиентов заказали в этом месяце\n\n` +
                `🎁 <b>Акция:</b> Дизайн-проект в подарок\n` +
                `🎁 Бесплатный выезд прораба\n` +
                `🎁 Скидка 7% при оплате за 2 этапа\n` +
                `⏰ До конца акции: <b>${getPromoTimeLeft()}</b>\n\n` +
                `<i>Нужна смета или консультация прораба?</i>`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.callback('📝 Заказать с бонусами', `ord_r_${key}`)
            ],
            [
                Markup.button.callback('📸 Примеры работ', `gallery_r_${key}`),
                Markup.button.callback('💬 Отзывы', `reviews_r_${key}`)
            ],
            [
                Markup.button.callback('🔙 Все услуги', 'menu_renovation')
            ]
        ])
    });
});

// Запуск заявки на ремонт
bot.action(/^ord_r_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    await ctx.deleteMessage().catch(() => {});
    await ctx.scene.enter('ORDER_SCENE', {
        interest: RENOVATION[key].name,
        type: 'renovation',
        priceNum: RENOVATION[key].priceNum
    });
});

// Отзывы по ремонту
bot.action('reviews_renovation', async (ctx) => {
    const renovationReviews = REVIEWS.filter(r => r.service.includes('Ремонт') || r.service.includes('Санузел'));

    let reviewText = '<b>⭐️ ОТЗЫВЫ О РЕМОНТЕ</b>\n\n';

    renovationReviews.forEach(r => {
        reviewText += `${r.rating} <b>${r.name}</b> — ${r.date}\n<i>${r.service}</i>\n"${r.text}"\n━━━━━━━━━\n`;
    });

    reviewText += `📊 Средняя оценка: <b>4.9/5</b> (${renovationReviews.length} отзывов)`;

    await ctx.editMessageCaption(reviewText, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.url('Смотреть все на 2ГИС', 'https://2gis.ru/')
            ],
            [
                Markup.button.callback('🔙 Назад', 'menu_renovation')
            ]
        ])
    });
});

// ============================================
// 8. ОБЩИЕ РАЗДЕЛЫ
// ============================================

// Все отзывы
bot.action('reviews', async (ctx) => {
    let reviewText = '<b>⭐️ ОТЗЫВЫ НАШИХ КЛИЕНТОВ</b>\n\n';

    REVIEWS.forEach(r => {
        reviewText += `${r.rating} <b>${r.name}</b> — ${r.date}\n<i>${r.service}</i>\n"${r.text}"\n━━━━━━━━━\n`;
    });

    reviewText += `📊 <b>Средняя оценка: 4.9 из 5</b>\n` +
                `💬 Всего отзывов: 124`;

    try {
        await ctx.editMessageCaption(reviewText, {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('📍 Яндекс.Карты', 'https://yandex.ru/maps/'),
                    Markup.button.url('📍 2ГИС', 'https://2gis.ru/')
                ],
                [
                    Markup.button.url('📸 Instagram', 'https://instagram.com/potolkoff_03')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        });
    } catch (e) {
        await ctx.reply(reviewText, {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('📍 Яндекс.Карты', 'https://yandex.ru/maps/'),
                    Markup.button.url('📍 2ГИС', 'https://2gis.ru/')
                ],
                [
                    Markup.button.url('📸 Instagram', 'https://instagram.com/potolkoff_03')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        });
    }
});

// Портфолио
bot.action(['portfolio', 'portfolio_ceilings', 'portfolio_renovation'], async (ctx) => {
    const action = ctx.callbackQuery.data;
    let caption = '';

    if (action === 'portfolio_ceilings') {
        caption = '📸 <b>НАШИ РАБОТЫ: НАТЯЖНЫЕ ПОТОЛКИ</b>\n' +
                 'Более 2000 установленных потолков за 2024 год.\n' +
                 'Смотрите фото "До" и "После" в нашем Instagram:';
    } else if (action === 'portfolio_renovation') {
        caption = '📸 <b>НАШИ РАБОТЫ: РЕМОНТ КВАРТИР</b>\n' +
                 'Полные циклы ремонта от проекта до клининга.\n' +
                 'Все работы в портфолио Instagram:';
    } else {
        caption = '📸 <b>ПОРТФОЛИО НАШИХ РАБОТ</b>\n' +
                 '✨ Натяжные потолки — 2000+ объектов\n' +
                 '🏗 Ремонт квартир — 350+ объектов\n\n' +
                 'Смотрите реальные фото в Instagram:';
    }

    try {
        await ctx.editMessageCaption(caption, {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('📱 Открыть Instagram', 'https://instagram.com/potolkoff_03'),
                    Markup.button.url('📹 YouTube канал', 'https://youtube.com/@potolkoff')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        });
    } catch (e) {
        await ctx.reply(caption, {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('📱 Открыть Instagram', 'https://instagram.com/potolkoff_03'),
                    Markup.button.url('📹 YouTube канал', 'https://youtube.com/@potolkoff')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ])
        });
    }
});

// Акции
bot.action('promo', async (ctx) => {
    await ctx.editMessageCaption(
        `🎁 <b>АКЦИИ ФЕВРАЛЯ 2026</b>\n\n` +
        `1️⃣ <b>При заказе потолков:</b>\n` +
        `🎁 2 встроенных светильника в подарок\n` +
        `🎁 Бесплатный выезд замерщика\n` +
        `🎁 Скидка 5% при заказе сегодня\n` +
        `🎁 Рассрочка 0% на 6 месяцев\n\n` +
        `2️⃣ <b>При ремонте под ключ:</b>\n` +
        `🎁 Дизайн-проект бесплатно (экономия 45.000₽)\n` +
        `🎁 Бесплатный выезд прораба\n` +
        `🎁 Скидка 7% при оплате за 2 этапа\n` +
        `🎁 Клининг после ремонта в подарок\n\n` +
        `3️⃣ <b>Рассрочка 0%</b> на 6-12 месяцев\n\n` +
        `⏰ Акции действуют: <b>${getPromoTimeLeft()}</b>\n\n` +
        `<i>Условия акций уточняйте у менеджера</i>`,
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback('✨ Потолки со скидкой', 'menu_ceilings'),
                    Markup.button.callback('🏗 Ремонт с бонусами', 'menu_renovation')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        }
    );
});

// Калькулятор
bot.action('calculator', async (ctx) => {
    await ctx.editMessageCaption(
        `🧮 <b>БЫСТРЫЙ КАЛЬКУЛЯТОР</b>\n\n` +
        `<b>НАТЯЖНЫЕ ПОТОЛКИ:</b>\n` +
        `• 20 м² × 2000₽ = <b>40.000₽</b>\n` +
        `• 30 м² × 2000₽ = <b>60.000₽</b>\n` +
        `• 40 м² × 2000₽ = <b>80.000₽</b>\n` +
        `• 50 м² × 2000₽ = <b>100.000₽</b>\n\n` +
        `<b>РЕМОНТ ПОД КЛЮЧ:</b>\n` +
        `• 35 м² × 15.000₽ = <b>525.000₽</b>\n` +
        `• 55 м² × 15.000₽ = <b>825.000₽</b>\n` +
        `• 75 м² × 15.000₽ = <b>1.125.000₽</b>\n\n` +
        `<i>⚠️ Это примерные расчёты. Точную смету подготовит замерщик бесплатно!</i>`,
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.callback('📏 Вызвать замерщика', 'call_measurer')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        }
    );
});

// Вызов замерщика через калькулятор
bot.action('call_measurer', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});
    await ctx.scene.enter('ORDER_SCENE', {
        interest: 'Вызов замерщика (бесплатно)',
        type: 'ceiling'
    });
});

// Контакты
bot.action('info', async (ctx) => {
    await ctx.editMessageCaption(
        `🏢 <b>КОНТАКТЫ ПОТОЛКОФ</b>\n\n` +
        `📍 <b>Адрес:</b>\n` +
        `г. Улан-Удэ, ул. Примерная, 15\n` +
        `(вход со двора, 2 этаж)\n\n` +
        `📞 <b>Телефон:</b>\n` +
        `+7 (983) 420-88-05\n\n` +
        `⏰ <b>Режим работы:</b>\n` +
        `Пн-Пт: 9:00 - 18:00\n` +
        `Сб: 10:00 - 16:00\n` +
        `Вс: выходной\n\n` +
        `💬 <b>Telegram:</b> @potolkoff_manager\n` +
        `📧 <b>Email:</b> info@potolkoff.ru\n\n` +
        `<b>💼 Работаем официально:</b>\n` +
        `• Договор с фиксацией цены\n` +
        `• Гарантия на работы\n` +
        `• Безналичный расчёт\n` +
        `• Рассрочка 0%`,
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('📍 Открыть на карте', 'https://yandex.ru/maps/'),
                    Markup.button.url('📱 Написать в WhatsApp', 'https://wa.me/79834208805')
                ],
                [
                    Markup.button.callback('🔙 В главное меню', 'back_home')
                ]
            ])
        }
    );
});

// ============================================
// 9. АДМИНКА (ОТВЕТ ПОЛЬЗОВАТЕЛЮ)
// ============================================

bot.on('text', async (ctx) => {
    // Проверяем, что это админ и это ответ на сообщение
    if (ctx.from.id == process.env.ADMIN_ID && ctx.message.reply_to_message) {
        const originalText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

        if (!originalText) return;

        // Ищем ID клиента в хештеге #id123456
        const match = originalText.match(/#id(\d+)/);

        if (match) {
            const userId = match[1];

            try {
                // Шлём ответ клиенту
                await ctx.telegram.sendMessage(
                    userId,
                    `👨‍💼 <b>Сообщение от менеджера Потолкоф:</b>\n\n${ctx.message.text}`,
                    {
                        parse_mode: 'HTML'
                    }
                );
                await ctx.reply('✅ Ответ доставлен клиенту.');
            } catch (e) {
                await ctx.reply('❌ Не удалось доставить (клиент заблокировал бота).');
            }
        }
    }
});

// ============================================
// 10. ЗАПУСК СЕРВЕРА (WEBHOOK ДЛЯ RAILWAY)
// ============================================

// Команда /ping для проверки работы бота
bot.command('ping', (ctx) => {
    const now = new Date().toISOString();
    ctx.reply(`🏓 Пинг бота успешно!\n\n🕐 Время сервера: ${now}\n🚀 Статус: Бот работает через Webhook (Railway)`);
});

app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => {
    res.send('🤖 Potolkoff Construction Bot v2.0 is Running!');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

const WEBHOOK_URL = process.env.WEBHOOK_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
    : null);

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    if (WEBHOOK_URL) {
        try {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(WEBHOOK_URL);
            console.log(`✅ Webhook set: ${WEBHOOK_URL}`);
        } catch (e) {
            console.error('❌ Failed to set webhook:', e.message);
        }
    } else {
        console.log('⚠️ No Webhook URL configured.');
        console.log('💡 For local development, uncomment bot.launch() below');
        // bot.launch();
    }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
