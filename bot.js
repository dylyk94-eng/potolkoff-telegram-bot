const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Получаем токен бота из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('Ошибка: Не указан токен бота. Создайте файл .env и добавьте BOT_TOKEN=ваш_токен');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Файл для хранения заявок
const REQUESTS_FILE = path.join(__dirname, 'requests.json');

// Функции для работы с заявками
function loadRequests() {
    try {
        if (fs.existsSync(REQUESTS_FILE)) {
            const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Ошибка при загрузке заявок:', error);
        return [];
    }
}

function saveRequests(requests) {
    try {
        fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf8');
    } catch (error) {
        console.error('Ошибка при сохранении заявок:', error);
    }
}

function createRequest(ctx) {
    const requests = loadRequests();
    const newRequest = {
        id: Date.now(),
        userId: ctx.from.id,
        userName: ctx.from.username || ctx.from.first_name || 'Не указано',
        createdAt: new Date().toISOString(),
        status: 'новая',
        data: ctx.session.request
    };
    requests.push(newRequest);
    saveRequests(requests);
    return newRequest;
}

// Отправка уведомления админу
async function notifyAdmin(ctx, request) {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (!ADMIN_ID) {
        console.warn('ADMIN_ID не указан в .env файле');
        return;
    }

    const createdAt = new Date(request.createdAt).toLocaleString('ru-RU');

    const message = `
🆕 НОВАЯ ЗАЯВКА #${request.id}

👤 Клиент: ${request.userName}
🆔 ID клиента: ${request.userId}
📅 Дата заявки: ${createdAt}

📋 Данные заявки:

🏠 Услуга: ${request.data.service}
📐 Площадь: ${request.data.area} м²
📍 Адрес: ${request.data.address}
👤 Контакты: ${request.data.contacts}
💬 Комментарий: ${request.data.comment || 'Нет'}

─────────────────────

Статус: ${request.status}
    `;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📞 Связаться с клиентом', callback_data: `admin_contact_${request.id}` }
                ],
                [
                    { text: '🔄 В работе', callback_data: `admin_status_progress_${request.id}` },
                    { text: '✅ Выполнено', callback_data: `admin_status_done_${request.id}` }
                ],
                [
                    { text: '📊 Все заявки', callback_data: 'admin_requests' }
                ]
            ]
        }
    };

    try {
        await ctx.telegram.sendMessage(ADMIN_ID, message, keyboard);
        console.log(`Уведомление отправлено админу (ID: ${ADMIN_ID})`);
    } catch (error) {
        console.error('Ошибка при отправке уведомления админу:', error);
    }
}

// Сцена оформления заявки
const requestScene = new Scenes.WizardScene(
    'request_wizard',
    // Шаг 1: Выбор услуги
    (ctx) => {
        ctx.session.request = {};
        const serviceKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Натяжные потолки', callback_data: 'req_service_0' },
                        { text: 'Многоуровневые', callback_data: 'req_service_1' }
                    ],
                    [
                        { text: '3D-потолки', callback_data: 'req_service_2' },
                        { text: 'Ремонт "под ключ"', callback_data: 'req_service_3' }
                    ],
                    [
                        { text: 'Дизайн интерьеров', callback_data: 'req_service_4' }
                    ],
                    [
                        { text: '❌ Отмена', callback_data: 'req_cancel' }
                    ]
                ]
            }
        };
        ctx.reply('📋 Шаг 1 из 5\n\nВыберите услугу:', serviceKeyboard);
        return ctx.wizard.next();
    },
    // Шаг 2: Ввод площади
    (ctx) => {
        if (ctx.callbackQuery) {
            const serviceIndex = parseInt(ctx.callbackQuery.data.split('_')[2]);
            const services = [
                'Натяжные потолки',
                'Многоуровневые потолки',
                '3D-потолки с фотопечатью',
                'Ремонт "под ключ"',
                'Дизайн интерьеров'
            ];
            ctx.session.request.service = services[serviceIndex];
            ctx.answerCbQuery();
            ctx.reply(`📋 Шаг 2 из 5\n\nВыбранная услуга: ${ctx.session.request.service}\n\nВведите площадь помещения (в м²):`);
        } else {
            ctx.reply('Пожалуйста, выберите услугу из предложенного списка.');
        }
        return ctx.wizard.next();
    },
    // Шаг 3: Ввод адреса
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const area = ctx.message.text.trim();
            if (!isNaN(area) && parseFloat(area) > 0) {
                ctx.session.request.area = parseFloat(area);
                ctx.reply(`📋 Шаг 3 из 5\n\nПлощадь: ${ctx.session.request.area} м²\n\nВведите адрес для замера:`);
            } else {
                ctx.reply('Пожалуйста, введите корректное число (площадь в м²).');
            }
        } else {
            ctx.reply('Пожалуйста, введите площадь числом.');
        }
        return ctx.wizard.next();
    },
    // Шаг 4: Ввод контактов
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const address = ctx.message.text.trim();
            if (address.length > 5) {
                ctx.session.request.address = address;
                const contactKeyboard = {
                    reply_markup: {
                        keyboard: [
                            [{ text: '📱 Отправить контакт', request_contact: true }],
                            [{ text: '✍️ Ввести вручную' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                };
                ctx.reply(`📋 Шаг 4 из 5\n\nАдрес: ${ctx.session.request.address}\n\nВыберите способ указания контактов:`, contactKeyboard);
            } else {
                ctx.reply('Пожалуйста, введите полный адрес (минимум 5 символов).');
            }
        }
        return ctx.wizard.next();
    },
    // Шаг 5: Комментарий (опционально)
    (ctx) => {
        let contacts;
        
        if (ctx.message && ctx.message.contact) {
            // Контакт отправлен через кнопку
            const contact = ctx.message.contact;
            contacts = `${contact.first_name || ''} ${contact.last_name || ''}, ${contact.phone_number}`.trim();
        } else if (ctx.message && ctx.message.text) {
            // Контакт введён вручную
            contacts = ctx.message.text.trim();
            if (contacts.toLowerCase() === 'ввести вручную') {
                ctx.reply('📋 Шаг 4 из 5 (продолжение)\n\nВведите ваше имя и номер телефона:\nНапример: Иван, +7 (983) 123-45-67');
                return ctx.wizard.next(); // Ждём ввода контакта вручную
            }
        }
        
        if (contacts && contacts.length > 5) {
            ctx.session.request.contacts = contacts;
            const skipKeyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⏭️ Пропустить', callback_data: 'req_skip_comment' }]
                    ]
                }
            };
            ctx.reply(`📋 Шаг 5 из 5\n\nКонтакты: ${ctx.session.request.contacts}\n\nДобавьте комментарий к заявке (необязательно):`, skipKeyboard);
            return ctx.wizard.next();
        }
        
        ctx.reply('Пожалуйста, отправьте контакт или введите имя и номер телефона.');
    },
    // Шаг 5.1: Ввод контакта вручную
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const contacts = ctx.message.text.trim();
            if (contacts.length > 5) {
                ctx.session.request.contacts = contacts;
                const skipKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⏭️ Пропустить', callback_data: 'req_skip_comment' }]
                        ]
                    }
                };
                ctx.reply(`📋 Шаг 5 из 5\n\nКонтакты: ${ctx.session.request.contacts}\n\nДобавьте комментарий к заявке (необязательно):`, skipKeyboard);
                return ctx.wizard.next();
            }
        }
        ctx.reply('Пожалуйста, введите имя и номер телефона.');
    },
    // Подтверждение заявки
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            if (ctx.message.text.toLowerCase() !== 'пропустить') {
                ctx.session.request.comment = ctx.message.text.trim();
            }

            const confirmKeyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Подтвердить', callback_data: 'req_confirm' },
                            { text: '❌ Отменить', callback_data: 'req_cancel' }
                        ],
                        [
                            { text: '📝 Изменить', callback_data: 'req_edit' }
                        ]
                    ]
                }
            };

            let summary = `
📋 Проверьте данные заявки:

🏠 Услуга: ${ctx.session.request.service}
📐 Площадь: ${ctx.session.request.area} м²
📍 Адрес: ${ctx.session.request.address}
👤 Контакты: ${ctx.session.request.contacts}
💬 Комментарий: ${ctx.session.request.comment || 'Нет'}
            `;

            ctx.reply(summary, confirmKeyboard);
        }
    }
);

// Обработка callback для пропуска комментария
requestScene.action('req_skip_comment', (ctx) => {
    ctx.session.request.comment = '';
    ctx.answerCbQuery();

    const confirmKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Подтвердить', callback_data: 'req_confirm' },
                    { text: '❌ Отменить', callback_data: 'req_cancel' }
                ],
                [
                    { text: '📝 Изменить', callback_data: 'req_edit' }
                ]
            ]
        }
    };

    let summary = `
📋 Проверьте данные заявки:

🏠 Услуга: ${ctx.session.request.service}
📐 Площадь: ${ctx.session.request.area} м²
📍 Адрес: ${ctx.session.request.address}
👤 Контакты: ${ctx.session.request.contacts}
💬 Комментарий: Нет
            `;

    ctx.reply(summary, confirmKeyboard);
    return ctx.wizard.next();
});

// Обработка callback для подтверждения
requestScene.action('req_confirm', async (ctx) => {
    const request = createRequest(ctx);
    ctx.answerCbQuery();

    ctx.reply('✅ Заявка успешно создана!\n\n' +
              'Номер заявки: #' + request.id + '\n' +
              'Статус: новая\n\n' +
              'Мы свяжемся с вами в ближайшее время для уточнения деталей.\n\n' +
              'Спасибо за обращение!');

    // Отправляем уведомление админу
    await notifyAdmin(ctx, request);

    ctx.scene.leave();
});

// Обработка callback для отмены
requestScene.action('req_cancel', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('❌ Заявка отменена.\n\nЕсли у вас возникнут вопросы, вы можете начать оформление заново через главное меню.', mainMenu);
    ctx.scene.leave();
});

// Обработка callback для редактирования
requestScene.action('req_edit', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('📝 Для изменения заявки начните оформление заново через главное меню.', mainMenu);
    ctx.scene.leave();
});

// Обработка callback для услуг
requestScene.action(/^req_service_\d+/, (ctx) => {
    const serviceIndex = parseInt(ctx.callbackQuery.data.split('_')[2]);
    const services = [
        'Натяжные потолки',
        'Многоуровневые потолки',
        '3D-потолки с фотопечатью',
        'Ремонт "под ключ"',
        'Дизайн интерьеров'
    ];
    ctx.session.request = ctx.session.request || {};
    ctx.session.request.service = services[serviceIndex];

    ctx.editMessageText(`📋 Шаг 2 из 6\n\nВыбранная услуга: ${ctx.session.request.service}\n\nВведите площадь помещения (в м²):`);
    return ctx.wizard.selectStep(2);
});

// Информация о компании
const companyInfo = {
    name: 'Потолкоф',
    fullName: 'Студия натяжных потолков, ремонта и дизайна',
    slogan: 'Дарим свет и уют вашему дому',
    stats: {
        objects: '1200+',
        clients: '500+',
        experience: '8',
        satisfaction: '98%'
    },
    contacts: {
        phone: '+7 (983) 420-88-05',
        telegram: '@potolkoff2024',
        vk: 'potolkoff03',
        instagram: '@potolkoff_03'
    },
    services: [
        { name: 'Натяжные потолки', price: 'от 2000 ₽/м²' },
        { name: 'Многоуровневые потолки', price: 'от 4500 ₽/м²' },
        { name: '3D-потолки с фотопечатью', price: 'от 3500 ₽/м²' },
        { name: 'Потолки с фотообоями', price: 'от 3000 ₽/м²' },
        { name: 'Тканевые потолки', price: 'от 2500 ₽/м²' },
        { name: 'Ремонт "под ключ"', price: 'по запросу' },
        { name: 'Дизайн интерьеров', price: 'по запросу' }
    ],
    features: [
        'Сертифицированные мастера и дизайнеры',
        'Гарантия 5 лет на все работы',
        'Бесплатный выезд замерщика',
        'Индивидуальный подход к каждому клиенту',
        'Комплексный ремонт "под ключ"'
    ]
};

// Главное меню
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '🏠 Потолки', callback_data: 'ceiling_menu' },
                { text: '📐 Калькулятор', callback_data: 'calculator' }
            ],
            [
                { text: '💰 Цены', callback_data: 'prices' },
                { text: '📞 Контакты', callback_data: 'contacts' }
            ],
            [
                { text: '📏 Заказать замер', callback_data: 'request_call' },
                { text: '🏗️ Портфолио', callback_data: 'portfolio' }
            ]
        ]
    }
};

// Меню потолков
const ceilingMenu = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'Натяжные потолки', callback_data: 'service_ceiling' },
                { text: 'Многоуровневые', callback_data: 'service_multi' }
            ],
            [
                { text: '3D-потолки', callback_data: 'service_3d' },
                { text: 'С фотообоями', callback_data: 'service_photowall' }
            ],
            [
                { text: 'Тканевые', callback_data: 'service_fabric' },
                { text: 'Сатиновые', callback_data: 'service_satin' }
            ],
            [
                { text: 'Глянцевые', callback_data: 'service_glossy' },
                { text: 'Матовые', callback_data: 'service_matte' }
            ],
            [
                { text: '◀️ Назад', callback_data: 'main_menu' }
            ]
        ]
    }
};

// Меню услуг
const servicesMenu = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'Натяжные потолки', callback_data: 'service_ceiling' },
                { text: 'Многоуровневые', callback_data: 'service_multi' }
            ],
            [
                { text: '3D-потолки', callback_data: 'service_3d' },
                { text: 'С фотообоями', callback_data: 'service_photowall' }
            ],
            [
                { text: 'Тканевые', callback_data: 'service_fabric' },
                { text: 'Сатиновые', callback_data: 'service_satin' }
            ],
            [
                { text: 'Глянцевые', callback_data: 'service_glossy' },
                { text: 'Матовые', callback_data: 'service_matte' }
            ],
            [
                { text: '📐 Калькулятор', callback_data: 'calculator' },
                { text: '◀️ Назад', callback_data: 'main_menu' }
            ]
        ]
    }
};

// Меню контактов
const contactsMenu = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '💬 Telegram', url: `https://t.me/${companyInfo.contacts.telegram.replace('@', '')}` },
                { text: '📱 VK', url: `https://vk.com/${companyInfo.contacts.vk}` }
            ],
            [
                { text: '📸 Instagram', url: `https://instagram.com/${companyInfo.contacts.instagram}` }
            ],
            [
                { text: '📞 Телефон: +7 (983) 420-88-05', callback_data: 'phone' }
            ],
            [
                { text: '◀️ Назад', callback_data: 'main_menu' }
            ]
        ]
    }
};

// Сцена калькулятора
const calculatorWizard = new Scenes.WizardScene(
    'calculator_wizard',
    // Шаг 1: Выбор типа потолка
    (ctx) => {
        ctx.session.calc = {};
        const calcKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Натяжные потолки', callback_data: 'calc_ceiling' },
                        { text: 'Многоуровневые', callback_data: 'calc_multi' }
                    ],
                    [
                        { text: '3D-потолки', callback_data: 'calc_3d' },
                        { text: 'С фотообоями', callback_data: 'calc_photo' }
                    ],
                    [
                        { text: '❌ Отмена', callback_data: 'calc_cancel' }
                    ]
                ]
            }
        };
        ctx.reply('📐 Калькулятор стоимости потолков\n\nВыберите тип потолка:', calcKeyboard);
        return ctx.wizard.next();
    },
    // Шаг 2: Ввод площади
    (ctx) => {
        if (ctx.callbackQuery) {
            const type = ctx.callbackQuery.data.split('_')[1];
            const types = {
                'ceiling': { name: 'Натяжные потолки', price: 2000 },
                'multi': { name: 'Многоуровневые потолки', price: 4500 },
                '3d': { name: '3D-потолки с фотопечатью', price: 3500 },
                'photo': { name: 'Потолки с фотообоями', price: 3000 }
            };
            ctx.session.calc.type = types[type];
            ctx.answerCbQuery();
            ctx.reply(`📐 Шаг 2 из 3\n\nВыбрано: ${ctx.session.calc.type.name}\n\nВведите площадь помещения (в м²):`);
        } else {
            ctx.reply('Пожалуйста, выберите тип потолка из предложенного списка.');
        }
        return ctx.wizard.next();
    },
    // Шаг 3: Результат
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const area = parseFloat(ctx.message.text.trim());
            if (!isNaN(area) && area > 0) {
                ctx.session.calc.area = area;
                const basePrice = ctx.session.calc.type.price * area;
                const minPrice = basePrice * 0.9;
                const maxPrice = basePrice * 1.2;

                const resultKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎯 Оформить заявку', callback_data: 'consultation' },
                                { text: '📏 Заказать замер', callback_data: 'request_call' }
                            ],
                            [
                                { text: '📊 Все цены', callback_data: 'prices' },
                                { text: '🏠 Главное меню', callback_data: 'main_menu' }
                            ]
                        ]
                    }
                };

                const resultMessage = `
💰 РАСЧЁТ СТОИМОСТИ

─────────────────────

🏠 Тип потолка:
${ctx.session.calc.type.name}

📐 Площадь помещения:
${area} м²

💵 Цена за м²:
${ctx.session.calc.type.price} ₽

─────────────────────

📊 ПРИМЕРНАЯ СТОИМОСТЬ:
${Math.round(minPrice).toLocaleString('ru-RU')} - ${Math.round(maxPrice).toLocaleString('ru-RU')} ₽

─────────────────────

💡 В стоимость ВХОДИТ:
✅ Материал потолка
✅ Установка и монтаж
✅ Базовая люстра

🔧 ОПЛАЧИВАЕТСЯ ОТДЕЛЬНО:
❗ Подсветка LED
❗ Угловые профили
❗ Дополнительные светильники

─────────────────────

🎁 ХОТИТЕ ТОЧНЫЙ РАСЧЁТ?
Закажите бесплатный замер!
                `;

                ctx.reply(resultMessage, resultKeyboard);
                ctx.scene.leave();
            } else {
                ctx.reply('Пожалуйста, введите корректное число (площадь в м²).');
            }
        } else {
            ctx.reply('Пожалуйста, введите площадь числом.');
        }
    }
);

// Обработка отмены калькулятора
calculatorWizard.action('calc_cancel', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('❌ Расчёт отменён.', mainMenu);
    ctx.scene.leave();
});

// Обработка выбора типа в калькуляторе
calculatorWizard.action(/^calc_/, (ctx) => {
    const type = ctx.callbackQuery.data.split('_')[1];
    const types = {
        'ceiling': { name: 'Натяжные потолки', price: 2000 },
        'multi': { name: 'Многоуровневые потолки', price: 4500 },
        '3d': { name: '3D-потолки с фотопечатью', price: 3500 },
        'photo': { name: 'Потолки с фотообоями', price: 3000 }
    };
    ctx.session.calc.type = types[type];
    ctx.editMessageText(`📐 Шаг 2 из 3\n\nВыбрано: ${ctx.session.calc.type.name}\n\nВведите площадь помещения (в м²):`);
    return ctx.wizard.next();
});

// Создаем Stage для сцен
const stage = new Scenes.Stage([requestScene, calculatorWizard]);

// Middleware для сессий
bot.use(session());

// Подключаем stage
bot.use(stage.middleware());

// Middleware для автоматического приветствия новых пользователей
bot.use(async (ctx, next) => {
    // Проверяем, это ли первый раз когда пользователь пишет боту
    if (!ctx.session.welcomed && ctx.message && !ctx.message.text.startsWith('/')) {
        ctx.session.welcomed = true;
        ctx.reply(welcomeMessage, startMenu);
        return;
    }
    return next();
});

// Приветственное сообщение
const welcomeMessage = `
✨ Добро пожаловать в мир красивых потолков!

🎨 *Потолкоф* — студия натяжных потолков в Улан-Удэ

${companyInfo.fullName}
"${companyInfo.slogan}"

─────────────────────

🌟 Почему выбирают нас?

🏆 ${companyInfo.stats.objects}+ выполненных объектов
⭐ ${companyInfo.stats.clients}+ довольных клиентов
🔥 ${companyInfo.stats.experience} лет опыта
💯 ${companyInfo.stats.satisfaction} рекомендаций

─────────────────────

✅ Что мы предлагаем:

🎭 Натяжные потолки — от 2000 ₽/м²
🏛️ Многоуровневые конструкции — от 4500 ₽/м²
🖼️ 3D-потолки с фотопечатью — от 3500 ₽/м²
🏠 Ремонт «под ключ» — по запросу
🎨 Дизайн интерьеров — по запросу

─────────────────────

🎁 Бесплатные услуги:

📏 Выезд замерщика
📝 Расчёт стоимости
💡 Консультация дизайнера

─────────────────────

🕒 Работаем для вас:

Пн-Пт: 9:00 — 18:00
Сб-Вс: выходной

─────────────────────

📞 Свяжитесь с нами:
${companyInfo.contacts.phone}
${companyInfo.contacts.telegram}
`;

// Меню старта
const startMenu = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '🚀 НАЧАТЬ', callback_data: 'start_now' }
            ]
        ]
    },
    parse_mode: 'Markdown'
};

// Запуск бота
bot.start((ctx) => {
    ctx.session.welcomed = true;
    ctx.reply(welcomeMessage, startMenu);
});

// Обработка кнопки НАЧАТЬ
bot.action('start_now', (ctx) => {
    ctx.session.welcomed = true;
    ctx.editMessageText(`
👋 Добро пожаловать, ${ctx.from.first_name || 'гость'}!

${companyInfo.fullName}
"${companyInfo.slogan}"

─────────────────────

Что вас интересует? 👇
`, mainMenu);
});

// Команда помощи
bot.help((ctx) => {
    ctx.reply('🤖 Бот Потолкоф поможет вам:\n' +
              '• Узнать о наших услугах\n' +
              '• Связаться с нами\n' +
              '• Оформить заявку (/request)\n' +
              '• Посмотреть свои заявки (/myrequests)\n\n' +
              'Используйте кнопки в меню для навигации.');
});

// Команда для оформления заявки
bot.command('request', (ctx) => {
    ctx.reply('🎯 Оформление заявки\n\nДавайте заполним небольшую форму для получения расчета стоимости и записи на замер.');
    ctx.scene.enter('request_wizard');
});

// Команда для просмотра своих заявок
bot.command('myrequests', (ctx) => {
    const requests = loadRequests();
    const userRequests = requests.filter(r => r.userId === ctx.from.id);

    if (userRequests.length === 0) {
        ctx.reply('📋 У вас пока нет заявок.\n\nОформить заявку: /request');
        return;
    }

    let message = '📋 Ваши заявки:\n\n';
    userRequests.forEach((req, index) => {
        const date = new Date(req.createdAt).toLocaleDateString('ru-RU');
        const statusEmoji = req.status === 'новая' ? '🆕' : req.status === 'в работе' ? '🔄' : req.status === 'выполнена' ? '✅' : '❓';
        message += `${index + 1}. ${statusEmoji} #${req.id}\n`;
        message += `   📅 ${date}\n`;
        message += `   🏠 ${req.data.service}\n`;
        message += `   📍 ${req.data.address}\n`;
        message += `   Статус: ${req.status}\n\n`;
    });

    ctx.reply(message);
});

// --- Админ-команды ---

// Показать контакты клиента
bot.action(/^admin_contact_\d+$/, (ctx) => {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ctx.from.id.toString() !== ADMIN_ID) {
        ctx.answerCbQuery('⛔ У вас нет прав для этой команды');
        return;
    }

    const requestId = parseInt(ctx.callbackQuery.data.split('_')[2]);
    const requests = loadRequests();
    const request = requests.find(r => r.id === requestId);

    if (!request) {
        ctx.answerCbQuery('❌ Заявка не найдена');
        return;
    }

    ctx.answerCbQuery();

    const contactMessage = `
📞 Контактные данные клиента

Заявка: #${request.id}
👤 Клиент: ${request.userName}
🆔 ID: ${request.userId}
📞 Контакты: ${request.data.contacts}
📍 Адрес: ${request.data.address}

─────────────────────

Чтобы связаться с клиентом, можете написать ему в Telegram: https://t.me/${request.userName}
    `;

    ctx.reply(contactMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💬 Написать в Telegram', url: `https://t.me/${request.userName}` }
                ]
            ]
        }
    });
});

// Изменить статус на "в работе"
bot.action(/^admin_status_progress_\d+$/, (ctx) => {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ctx.from.id.toString() !== ADMIN_ID) {
        ctx.answerCbQuery('⛔ У вас нет прав для этой команды');
        return;
    }

    const requestId = parseInt(ctx.callbackQuery.data.split('_')[3]);
    const requests = loadRequests();
    const request = requests.find(r => r.id === requestId);

    if (!request) {
        ctx.answerCbQuery('❌ Заявка не найдена');
        return;
    }

    request.status = 'в работе';
    saveRequests(requests);

    ctx.answerCbQuery('✅ Статус изменён на "В работе"');

    // Уведомляем клиента об изменении статуса
    ctx.telegram.sendMessage(request.userId, `
🔄 Ваша заявка принята в работу!

Номер заявки: #${request.id}
Статус: ${request.status}

Мы свяжемся с вами в ближайшее время для уточнения деталей.
    `);
});

// Изменить статус на "выполнено"
bot.action(/^admin_status_done_\d+$/, (ctx) => {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ctx.from.id.toString() !== ADMIN_ID) {
        ctx.answerCbQuery('⛔ У вас нет прав для этой команды');
        return;
    }

    const requestId = parseInt(ctx.callbackQuery.data.split('_')[3]);
    const requests = loadRequests();
    const request = requests.find(r => r.id === requestId);

    if (!request) {
        ctx.answerCbQuery('❌ Заявка не найдена');
        return;
    }

    request.status = 'выполнена';
    saveRequests(requests);

    ctx.answerCbQuery('✅ Статус изменён на "Выполнено"');

    // Уведомляем клиента об изменении статуса
    ctx.telegram.sendMessage(request.userId, `
✅ Ваша заявка выполнена!

Номер заявки: #${request.id}
Статус: ${request.status}

Благодарим за сотрудничество! Если у вас есть ещё вопросы, мы всегда на связи.
    `);
});

// Показать все заявки (только админу)
bot.action('admin_requests', (ctx) => {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ctx.from.id.toString() !== ADMIN_ID) {
        ctx.answerCbQuery('⛔ У вас нет прав для этой команды');
        return;
    }

    ctx.answerCbQuery();

    const requests = loadRequests();

    if (requests.length === 0) {
        ctx.reply('📋 Заявок пока нет.');
        return;
    }

    // Сортируем по дате (новые сверху)
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let message = '📋 Все заявки:\n\n';
    requests.forEach((req, index) => {
        const date = new Date(req.createdAt).toLocaleDateString('ru-RU');
        const statusEmoji = req.status === 'новая' ? '🆕' : req.status === 'в работе' ? '🔄' : req.status === 'выполнена' ? '✅' : '❓';
        message += `${index + 1}. ${statusEmoji} #${req.id}\n`;
        message += `   📅 ${date}\n`;
        message += `   👤 ${req.userName} (ID: ${req.userId})\n`;
        message += `   🏠 ${req.data.service}\n`;
        message += `   📍 ${req.data.address}\n`;
        message += `   Статус: ${req.status}\n\n`;
    });

    ctx.reply(message);
});

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
    const text = ctx.message.text.toLowerCase();

    if (text.includes('привет') || text.includes('здравствуй')) {
        ctx.reply('Здравствуйте! Добро пожаловать в студию Потолкоф! 🎉\n\n' +
                  'Я могу рассказать вам о наших услугах и помочь связаться с нами.',
                  mainMenu);
    } else if (text.includes('услуг') || text.includes('работ') || text.includes('цена')) {
        ctx.reply('Вот список наших основных услуг:', servicesMenu);
    } else if (text.includes('контакт') || text.includes('телефон') || text.includes('связ')) {
        ctx.reply('Наши контактные данные:', contactsMenu);
    } else {
        ctx.reply('Спасибо за сообщение! Вот главное меню:', mainMenu);
    }
});

// Обработка инлайн-кнопок
bot.action('main_menu', (ctx) => {
    ctx.editMessageText(welcomeMessage, mainMenu);
});

// Меню потолков
bot.action('ceiling_menu', (ctx) => {
    const ceilingMessage = `
🏠 Виды потолков

─────────────────────

Выберите тип потолка, чтобы узнать подробнее:

💡 Нажмите на кнопку ниже ⬇️
    `;
    ctx.editMessageText(ceilingMessage, ceilingMenu);
});

// Калькулятор стоимости
bot.action('calculator', (ctx) => {
    ctx.scene.enter('calculator_wizard');
});

// Цены
bot.action('prices', (ctx) => {
    let pricesMessage = `
💰 ЦЕНЫ НА УСЛУГИ

─────────────────────
    `;

    companyInfo.services.forEach((service, index) => {
        pricesMessage += `${index + 1}. <b>${service.name}</b>\n   ${service.price}\n\n`;
    });

    pricesMessage += `
─────────────────────

💡 Итоговая стоимость зависит от:
📐 Площади помещения
🎨 Сложности работ
🏗️ Выбранных материалов

─────────────────────

🎁 ХОТИТЕ ТОЧНЫЙ РАСЧЁТ?
Используйте калькулятор или закажите замер!
    `;

    ctx.editMessageText(pricesMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📐 Рассчитать', callback_data: 'calculator' },
                    { text: '📏 Заказать замер', callback_data: 'request_call' }
                ],
                [
                    { text: '◀️ Назад', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});

// Заказать звонок
bot.action('request_call', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('request_wizard');
});

// Портфолио
bot.action('portfolio', (ctx) => {
    const portfolioMessage = `
🏗️ ПОРТФОЛИО НАШИХ РАБОТ

─────────────────────

📸 Выполнено более ${companyInfo.stats.objects} объектов!

─────────────────────

🎨 НАШИ РАБОТЫ:
• Натяжные потолки в квартирах и домах
• Многоуровневые конструкции с подсветкой
• 3D-потолки с фотопечатью
• Комплексный ремонт под ключ

─────────────────────

📊 СТАТИСТИКА:
• ${companyInfo.stats.objects}+ выполненных объектов
• ${companyInfo.stats.clients}+ довольных клиентов
• ${companyInfo.stats.experience} лет опыта
• ${companyInfo.stats.satisfaction} рекомендаций

─────────────────────

💼 ХОТИТЕ УВИДЕТЬ ПРИМЕРЫ?
Выберите категорию ниже ⬇️
    `;

    ctx.editMessageText(portfolioMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📸 Фото работ', url: 'https://vk.com/potolkoff03' },
                    { text: '🎥 Видеообзоры', url: 'https://t.me/potolkoff2024' }
                ],
                [
                    { text: '💬 Отзывы клиентов', url: 'https://vk.com/topic-172808215_48667766' }
                ],
                [
                    { text: '◀️ Назад', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});

bot.action('contacts', (ctx) => {
    const contactMessage = `
📞 НАШИ КОНТАКТЫ

─────────────────────

💬 Telegram:
${companyInfo.contacts.telegram}

📱 VK:
vk.com/${companyInfo.contacts.vk}

📸 Instagram:
${companyInfo.contacts.instagram}

─────────────────────

🕒 РАБОЧЕЕ ВРЕМЯ:
Пн-Пт: 9:00 - 18:00
Сб-Вс: выходной

─────────────────────

📞 НУЖЕН ЗВОНОК?
Нажмите кнопку ниже ⬇️
    `;
    ctx.editMessageText(contactMessage, contactsMenu);
});

// Обработчик телефона с кнопками "Написать в Telegram" и "Поделиться"
bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    
    const phoneNumber = '+7 (983) 420-88-05';
    const sharePhone = phoneNumber.replace(/\s/g, '').replace(/\(/g, '').replace(/\)/g, '');
    const shareText = encodeURIComponent('Здравствуйте, это Потолкоф!');
    const shareUrl = 'https://t.me/share?url=' + sharePhone + '&text=' + shareText;
    const telegramUrl = 'https://t.me/potolkoff2024';
    
    ctx.reply(
`📞 НАШ ТЕЛЕФОН

─────────────────────

${phoneNumber}

─────────────────────

🕒 РАБОЧЕЕ ВРЕМЯ:
Пн-Пт: 9:00 - 18:00
Сб-Вс: выходной

─────────────────────

💡 Если мы не ответили - напишите нам в Telegram!
    `, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💬 Написать в Telegram', url: telegramUrl },
                    { text: '📤 Поделиться', url: shareUrl }
                ],
                [
                    { text: '◀️ Назад', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});

bot.action('services', (ctx) => {
    let servicesMessage = `
💼 НАШИ УСЛУГИ

─────────────────────
    `;

    companyInfo.services.forEach((service, index) => {
        servicesMessage += `${index + 1}. <b>${service.name}</b>\n   💵 ${service.price}\n\n`;
    });

    servicesMessage += `
─────────────────────

💡 ХОТИТЕ УЗНАТЬ БОЛЬШЕ?
Нажмите на услугу в меню ниже ⬇️
    `;

    ctx.editMessageText(servicesMessage, servicesMenu);
});

bot.action('about', (ctx) => {
    let aboutMessage = `
ℹ️ О КОМПАНИИ ${companyInfo.name}

─────────────────────

${companyInfo.fullName}

"${companyInfo.slogan}"

─────────────────────

🏙️ РАБОТАЕМ В:
Улан-Удэ и Бурятии

👷 КОМАНДА ПРОФЕССИОНАЛОВ:
Создаем уют и комфорт в домах уже ${companyInfo.stats.experience}+ лет!

─────────────────────

✨ НАШИ ПРЕИМУЩЕСТВА:
    `;
    companyInfo.features.forEach(feature => {
        aboutMessage += `✅ ${feature}\n`;
    });

    aboutMessage += `
─────────────────────

📞 СВЯЖИТЕСЬ С НАМИ:
${companyInfo.contacts.phone}
${companyInfo.contacts.telegram}
    `;

    ctx.editMessageText(aboutMessage, mainMenu);
});

bot.action('stats', (ctx) => {
    const statsMessage = `
📊 НАША СТАТИСТИКА

─────────────────────

🏠 Объектов выполнено:
${companyInfo.stats.objects}

👥 Довольных клиентов:
${companyInfo.stats.clients}+

⏰ Лет на рынке:
${companyInfo.stats.experience}

⭐ Уровень удовлетворенности:
${companyInfo.stats.satisfaction}

─────────────────────

💡 ЧТО ЭТО ЗНАЧИТ:
• Мы знаем своё дело
• Клиенты доверяют нам
• Качество гарантируем
• Репутация важна

─────────────────────

🎁 Выбираете нас — выбираете качество!
    `;

    ctx.editMessageText(statsMessage, mainMenu);
});

bot.action('consultation', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🎯 Оформление заявки\n\nДавайте заполним небольшую форму для получения расчета стоимости и записи на замер.');
    ctx.scene.enter('request_wizard');
});

// Обработка выбора конкретных услуг
// Обработка выбора конкретных услуг
bot.action(/^service_/, (ctx) => {
    const serviceCode = ctx.callbackQuery.data.split('_')[1];
    let serviceDetail = '';

    switch(serviceCode) {
        case 'ceiling':
            serviceDetail = `
<b>НАТЯЖНЫЕ ПОТОЛКИ — КЛАССИКА РЕШЕНИЙ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Натяжные потолки — современное решение для отделки помещений, представляющее собой прочное полотно, натягиваемое на специальный багетный профиль. Это проверенная временем технология, которая сочетает в себе эстетику и практичность.

<b>✨ Преимущества натяжных потолков:</b>

🔹 <b>Долговечность</b> — срок службы от 15-20 лет без потери внешнего вида
🔹 <b>Влагостойкость</b> — идеально подходят для ванных комнат и кухонь
🔹 <b>Сейсмостойкость</b> — выдерживают до 100 литров воды на 1 м² при протечках
🔹 <b>Экологичность</b> — безвредные для здоровья материалы
🔹 <b>Гигиеничность</b> — не накапливают пыль и не требуют сложного ухода

<b>🎭 Фактуры и материалы:</b>

• <b>ПВХ пленка</b> — бюджетное решение, влагостойкое, широкий выбор фактур
• <b>Тканевое полотно</b> — элитное решение, breathable (дышит), не боится низких температур

<b>🏆 Почему выбирают Потолкоф?</b>

⚙️ <b>Собственное производство</b> — без посредников и наценок
👨‍🔧 <b>Сертифицированные мастера</b> — более 5000 успешных установок
✅ <b>Гарантия 5 лет</b> — работаем честно и на совесть
🎨 <b>400+ оттенков</b> — создадим потолок под ваш интерьер

<b>📐 Сроки монтажа:</b>

• Квартира до 100 м² — 1 день
• Коттедж до 200 м² — 2-3 дня
• Офисные помещения — по договорённости

─────────────────────

💡 <b>Совет эксперта:</b>

Для жилых помещений рекомендуем тканевый потолок — он пропускает воздух, создаёт ощущение «дышащего» интерьера и имеет более благородную фактуру.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выезд замерщика
✓ 3D-визуализация
✓ Расчёт сметы
            `;
            break;
        case 'multi':
            serviceDetail = `
<b>МНОГОУРОВНЕВЫЕ ПОТОЛКИ — АРХИТЕКТУРА СВЕТА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[1].price}

─────────────────────

<b>🎨 Что это такое?</b>

Многоуровневые потолки — это композиция из нескольких плоскостей, расположенных на разной высоте. Это не просто потолок, а полноценный архитектурный элемент, который кардинально меняет восприятие пространства.

<b>✨ Почему стоит выбрать многоуровневые потолки?</b>

🎯 <b>Зонирование</b> — визуально разделяем пространство на зоны без стен
📏 <b>Визуальное увеличение</b> — правильная игра света расширяет помещение
🎨 <b>Уникальный дизайн</b> — создаём эксклюзив, который нельзя купить в магазине
💡 <b>Подсветка</b> — встроенная LED-подсветка создаёт атмосферу

<b>🌟 Варианты реализации:</b>

• <b>Криволинейные формы</b> — волны, круги, плавные переходы
• <b>Геометрические фигуры</b> — квадраты, прямоугольники, ромбы
• <b>Комбинации фактур</b> — глянец + мат, разные цвета, фотопечать

<b>💡 Типы подсветки:</b>

🔹 <b>LED-лента</b> — экономичная, с пультом управления (цвет, яркость)
🔹 <b>Неоновая лента</b> — яркое равномерное свечение
🔹 <b>Дюралайт</b> — для контурной подсветки
🔹 <b>Споты</b> — точечное освещение с регулировкой угла

<b>🏆 Преимущества Потолкоф:</b>

🎨 <b>Собственная студия дизайна</b> — разработаем уникальный проект
📐 <b>Бесплатный 3D-проект</b> — увидите результат до монтажа
👨‍🎨 <b>Дизайнеры с опытом от 5 лет</b> — знаем, что модно и практично
✅ <b>Комплексная гарантия</b> — на полотно, установку, подсветку

<b>📐 Сроки реализации:</b>

• Дизайн-проект — 1-2 дня
• Монтаж — 3-5 дней (зависит от сложности)

─────────────────────

💡 <b>Совет эксперта:</b>

Многоуровневые потолки лучше всего подходят для помещений с высотой потолков от 2,7 метра. При меньшей высоте рекомендуем один уровень с имитацией глубины за счёт подсветки.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Авторский дизайн-проект
✓ 3D-визуализация (3-5 ракурсов)
✓ Выбор материалов в шоуруме
            `;
            break;
        case '3d':
            serviceDetail = `
<b>3D-ПОТОЛКИ С ФОТОПЕЧАТЬЮ — ИСКУССТВО НАД ГОЛОВОЙ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[2].price}

─────────────────────

<b>🎨 Что это такое?</b>

3D-потолки с фотопечатью — это реалистичное изображение любого сюжета на полотне потолка, которое создаёт эффект объёма и глубины. Это превращает обычный потолок в произведение искусства.

<b>✨ Что можно нанести?</b>

🌅 <b>Небо и облака</b> — классика, создаёт ощущение простора
🏔️ <b>Пейзажи</b> — горы, море, лес — уноситесь мечтами в путешествие
🎨 <b>Абстракции</b> — современные узоры, геометрия, цветовые переходы
👨‍👩‍👧 <b>Семейные фото</b> — лучшие моменты вашей жизни
🚀 <b>Фантазийные сюжеты</b> — космос, подводный мир, сказочные герои
🏢 <b>Корпоративная символика</b> — логотипы, брендирование для офисов

<b>🎭 Технические характеристики:</b>

🔹 <b>Разрешение печати</b> — до 1440 dpi — фотографическая чёткость
🔹 <b>Пигменты</b> — не выгорают на солнце, не тускнеют
🔹 <b>Стойкость</b> — к влаге, механическим воздействиям, УФ-излучению
🔹 <b>Безопасность</b> — экологически чистые чернила

<b>🏆 Почему Потолкоф?</b>

🖨️ <b>Собственное печатающее оборудование</b> — полный контроль качества
🎨 <b>Архив изображений</b> — 5000+ готовых сюжетов на выбор
👨‍🎨 <b>Дизайнеры</b> — создадим уникальный макет по вашему описанию
✅ <b>Тестовая печать</b> — утвердите образец до печати всего потолка

<b>📐 Особенности монтажа:</b>

• Тканевые потолки — ширина до 5 м без стыка
• ПВХ пленка — ширина до 3.2 м, бесшовная печать

─────────────────────

💡 <b>Совет эксперта:</b>

Для детских комнат рекомендуем сюжеты с мягкими, тёплыми цветами и позитивными образами. Избегайте слишком контрастных или агрессивных изображений — потолок должен успокаивать, а не возбуждать.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Подбор изображения из архива
✓ Создание макета по вашему описанию
✓ Тестовая печать фрагмента
            `;
            break;
        case 'photowall':
            serviceDetail = `
<b>ПОТОЛКИ С ФОТООБОЯМИ — БЮДЖЕТНОЕ РЕШЕНИЕ ДЛЯ ТВОРЧЕСТВА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[3].price}

─────────────────────

<b>🎨 Что это такое?</b>

Потолки с фотообоями — это натяжной потолок с нанесённым изображением, выполненным методом фотопечати на специальном полотне. Отличное решение для создания уникального интерьера по доступной цене.

<b>✨ Преимущества фотообоев:</b>

💰 <b>Доступная цена</b> — в 1.5-2 раза дешевле художественной росписи
🎨 <b>Любое изображение</b> — нанесём ваш рисунок или выберите из каталога
⚡ <b>Быстрый монтаж</b> — 1-2 дня после утверждения макета
🔧 <b>Ремонтопригодность</b> — при повреждении заменяем только часть полотна

<b>🎭 Темы для фотообоев:</b>

🌸 <b>Для детских</b> — мультики, животные, сказочные персонажи
🎯 <b>Для гостиной</b> — абстракции, классические узоры, пейзажи
🍳 <b>Для кухни</b> — натюрморты, фрукты, узоры в стиле прованс
💼 <b>Для офиса</b> — корпоративная символика, мотивационные цитаты

<b>🏆 Почему выбирают Потолкоф?</b>

🖨️ <b>Качественная печать</b> — 720 dpi, не выгорает
🎨 <b>Каталог изображений</b> — более 2000 вариантов на выбор
👨‍💻 <b>Дизайнеры</b> — подготовим ваш файл к печати
✅ <b>Гарантия</b> — 3 года на качество печати и монтаж

─────────────────────

💡 <b>Совет эксперта:</b>

При выборе изображения учитывайте освещение в помещении. На светлом фотообое светильники могут создавать блики, на тёмном — наоборот, скрывать фактуру. Лучше посоветоваться с дизайнером.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Подбор изображения из каталога
✓ Подготовка макета к печати
            `;
            break;
        case 'fabric':
            serviceDetail = `
<b>ТКАНЕВЫЕ ПОТОЛКИ — ЭЛИТА СРЕДИ НАТЯЖНЫХ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[4].price}

─────────────────────

<b>🎨 Что это такое?</b>

Тканевые потолки — это полотно из полимерной ткани, которое натягивается на каркас. В отличие от ПВХ пленки, ткань «дышит», пропускает воздух и создаёт ощущение натурального материала.

<b>✨ Преимущества тканевых потолков:</b>

🌬️ <b>Дышащий материал</b> — пропускает воздух, создаёт комфортный микроклимат
❄️ <b>Устойчивость к холоду</b> — можно монтировать при температуре до -15°C
🔨 <b>Прочность</b> — не рвётся при механических воздействиях
🎨 <b>Фактура</b> — приятная на ощупь, похожа на дорогие обои
🔥 <b>Безопасность</b> — при пожаре не выделяет токсичных веществ

<b>🎭 Особенности эксплуатации:</b>

• <b>Можно мыть</b> — мягкой губкой с неагрессивными средствами
• <b>Не притягивает пыль</b> — антистатические свойства
• <b>Не ржавеют</b> — устойчивость к влажности
• <b>Ремонтопригодны</b> — при порезе можно заклеить специальным клеем

<b>🏆 Почему выбирают Потолкоф?</b>

🏭 <b>Премиальные материалы</b> — работаем с Clipso, Descor, Cerutti
👨‍🔧 <b>Специализированные мастера</b> — монтаж только тканевых потолков
✅ <b>Гарантия</b> — 7 лет на монтаж и материал
🎁 <b>Крупноформатная печать</b> — ширина до 5 м без шва

<b>📐 Где лучше всего подходят:</b>

✓ Спальни — тёплая фактура, уютная атмосфера
✓ Детские — экологичные, безопасные материалы
✓ Нежилые помещения — лоджии, балконы, неотапливаемые комнаты

─────────────────────

💡 <b>Совет эксперта:</b>

Тканевые потолки идеально сочетаются с деревянной мебелью и классическим интерьером. Для современных минималистичных стилей выбирайте гладкие, матовые оттенки без яркого рисунка.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выбор материалов в шоуруме
✓ Образцы цветов и фактур на дом
            `;
            break;
        case 'satin':
            serviceDetail = `
<b>САТИНОВЫЕ ПОТОЛКИ — МЯГКАЯ БАРХАТИСТАЯ КРАСОТА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Сатиновый потолок — это натяжной потолок с особой фактурой, которая находится посередине между матовым и глянцевым. Слегка перламутровый отлив, мягкое рассеивание света — это элегантность и understatement.

<b>✨ Преимущества сатиновых потолков:</b>

🌟 <b>Уникальная фактура</b> — мягкое свечение, перламутровый отлив
💡 <b>Рассеивание света</b> — нет ярких бликов, мягкое освещение
🎨 <b>Универсальность</b> — подходят к любому стиля интерьера
👀 <b>Визуальный эффект</b> — «дорогой» вид без высокой цены
🔧 <b>Маскировка</b> — скрывают неровности базового потолка

<b>🎭 Где особенно хорошо смотрятся:</b>

• <b>Спальни</b> — создают расслабляющую атмосферу
• <b>Гостиные</b> — элегантно, без вычурности
• <b>Прихожие</b> — не притягивают внимание к пыли
• <b>Офисы</b> — строго, профессионально

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>200+ оттенков</b> — от нежно-белого до тёмного графита
👨‍🔧 <b>Опытные мастера</b> — идеально натянутый потолок без складок
✅ <b>Гарантия</b> — 5 лет на монтаж и материал
💎 <b>Премиум качество</b> — работаем только с проверенными поставщиками

<b>📐 Технические характеристики:</b>

• Ширина рулона — 1.3 – 3.2 м
• Толщина полотна — 0.17-0.19 мм
• Прочность на разрыв — 130 кг/см²

─────────────────────

💡 <b>Совет эксперта:</b>

Сатиновый потолок — лучший выбор для спален, так как он не создаёт бликов от ночников или лунного света. Нежный перламутровый отлив визуально делает потолок выше, что особенно важно для комнат с высотой до 2.5 метра.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Образцы цветов
✓ Виртуальная визуализация в вашем интерьере
            `;
            break;
        case 'glossy':
            serviceDetail = `
<b>ГЛЯНЦЕВЫЕ ПОТОЛКИ — ЗЕРКАЛЬНЫЙ ЭФФЕКТ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Глянцевый потолок — это натяжной потолок с зеркальной поверхностью, который отражает свет и окружающее пространство, создавая визуальный эффект увеличения высоты помещения.

<b>✨ Преимущества глянцевых потолков:</b>

🪞 <b>Зеркальный эффект</b> — визуально увеличивают высоту на 20-30%
💡 <b>Отражение света</b> — делают помещение светлее без дополнительных светильников
🎨 <b>Яркость и насыщенность</b> — глубокие, сочные цвета
🧼 <b>Лёгкая очистка</b> — легко моются, не впитывают запахи
💎 <b>Эффектность</b> — выглядят дорого и современно

<b>🎭 Особенности использования:</b>

• <b>Идеальны для небольших помещений</b> — визуально расширяют
• <b>Подходят для помещений с хорошим освещением</b> — подчёркивают игру света
• <b>Требуют аккуратности</b> — видны пыль, отпечатки, царапины
• <b>Лучше в светлых оттенках</b> — белый, молочный, слоновая кость

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>Премиальные материалы</b> — глянец без дефектов, идеально ровный
👨‍🔧 <b>Эксперты по глянцу</b> — знаем секреты идеального монтажа
✅ <b>Гарантия</b> — 5 лет, дополнительно — обслуживание
💎 <b>Контроль качества</b> — проверяем каждое полотно перед установкой

<b>📐 Где лучше всего подходят:</b>

✓ Небольшие коридоры — визуальное увеличение
✓ Кухни — легко моются, светло
✓ Ванные — зеркальный эффект, влагостойкость
✓ Гостиные с хорошим освещением — подчёркивают свет

⚠️ <b>Где не рекомендуем:</b>

✗ Спальни — блики могут мешать сну
✗ Помещения с плохим освещением — будут выглядеть тускло

─────────────────────

💡 <b>Совет эксперта:</b>

Для глянцевого потолка выбирайте максимально светлый оттенок — белый, молочный или светло-бежевый. Тёмные оттенки визуально «давят», отражая тёмные оттенки стен и мебели. Идеальная комбинация — белый глянцевый потолок + светлые стены.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выбор оттенков из каталога
✓ Образцы на дом
✓ Консультация по освещению
            `;
            break;
        case 'matte':
            serviceDetail = `
<b>МАТОВЫЕ ПОТОЛКИ — КЛАССИКА И УНИВЕРСАЛЬНОСТЬ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Матовый потолок — это натяжной потолок с шероховатой поверхностью, которая не отражает свет. Это классическое решение, которое подходит к любому интерьеру и никогда не выходит из моды.

<b>✨ Преимущества матовых потолков:</b>

🌫️ <b>Нет бликов</b> — идеально ровное рассеивание света
🎨 <b>Универсальность</b> — подходят к любому стилю и цвету стен
👀 <b>Визуальный комфорт</b> — не отвлекают, создают уют
🧼 <b>Лёгкий уход</b> — мягкая губка с неагрессивным средством
🔧 <b>Маскировка</b> — скрывают все неровности базового потолка

<b>🎭 Особенности:</b>

• <b>Широкая палитра</b> — более 400 оттенков
• <b>Текстура</b> — приятная на ощупь, напоминает качественную штукатурку
• <b>Стойкость</b> — не выгорают, не желтеют со временем
• <b>Безопасность</b> — экологичные материалы, не токсичны

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>Сертифицированные материалы</b> — только проверённые поставщики
👨‍🔧 <b>Опытные мастера</b> — более 5000 установок матовых потолков
✅ <b>Гарантия</b> — 5 лет на монтаж и материал
💎 <b>Контроль качества</b> — проверяем перед установкой

<b>📐 Идеально подходят для:</b>

✓ Спален — отсутствие бликов, спокойный цвет
✓ Детских — безопасность, экологичность
✓ Офисов — строго, профессионально
✓ Классических интерьеров — безупречно сочетаются

<b>🎭 Цвета для разных помещений:</b>

• <b>Спальни</b> — нежные пастельные, молочный, светло-бежевый
• <b>Гостиные</b> — классический белый, кремовый, слоновая кость
• <b>Детские</b> — нежные голубые, розовые, мятные
• <b>Офисы</b> — белый, серый, графит

─────────────────────

💡 <b>Совет эксперта:</b>

Матовый потолок — это безопасный выбор, который никогда не разочарует. Если вы не уверены, какой потолок выбрать, начинайте с матового белого — это беспроигрышный вариант, который смотрится дорого и благородно.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Образцы цветов
✓ Выбор оттенков с учётом вашего интерьера
✓ Консультация дизайнера
            `;
            break;
        default:
            serviceDetail = 'Уточните информацию об этой услуге у нашего менеджера.';
    }

    ctx.editMessageText(serviceDetail, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📏 Заказать замер', callback_data: 'request_call' },
                    { text: '💬 Написать в Telegram', url: `https://t.me/${companyInfo.contacts.telegram.replace('@', '')}` }
                ],
                [
                    { text: '📐 Калькулятор', callback_data: 'calculator' },
                    { text: '💰 Цены', callback_data: 'prices' }
                ],
                [
                    { text: '◀️ Назад', callback_data: 'ceiling_menu' },
                    { text: '🏠 Главное меню', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});

// Обработка callback для услуги из меню потолков
bot.action(/^service_/, (ctx) => {
    const serviceCode = ctx.callbackQuery.data.split('_')[1];
    let serviceDetail = '';

    switch(serviceCode) {
        case 'ceiling':
            serviceDetail = `
<b>НАТЯЖНЫЕ ПОТОЛКИ — КЛАССИКА РЕШЕНИЙ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Натяжные потолки — современное решение для отделки помещений, представляющее собой прочное полотно, натягиваемое на специальный багетный профиль. Это проверенная временем технология, которая сочетает в себе эстетику и практичность.

<b>✨ Преимущества натяжных потолков:</b>

🔹 <b>Долговечность</b> — срок службы от 15-20 лет без потери внешнего вида
🔹 <b>Влагостойкость</b> — идеально подходят для ванных комнат и кухонь
🔹 <b>Сейсмостойкость</b> — выдерживают до 100 литров воды на 1 м² при протечках
🔹 <b>Экологичность</b> — безвредные для здоровья материалы
🔹 <b>Гигиеничность</b> — не накапливают пыль и не требуют сложного ухода

<b>🎭 Фактуры и материалы:</b>

• <b>ПВХ пленка</b> — бюджетное решение, влагостойкое, широкий выбор фактур
• <b>Тканевое полотно</b> — элитное решение, breathable (дышит), не боится низких температур

<b>🏆 Почему выбирают Потолкоф?</b>

⚙️ <b>Собственное производство</b> — без посредников и наценок
👨‍🔧 <b>Сертифицированные мастера</b> — более 5000 успешных установок
✅ <b>Гарантия 5 лет</b> — работаем честно и на совесть
🎨 <b>400+ оттенков</b> — создадим потолок под ваш интерьер

<b>📐 Сроки монтажа:</b>

• Квартира до 100 м² — 1 день
• Коттедж до 200 м² — 2-3 дня
• Офисные помещения — по договорённости

─────────────────────

💡 <b>Совет эксперта:</b>

Для жилых помещений рекомендуем тканевый потолок — он пропускает воздух, создаёт ощущение «дышащего» интерьера и имеет более благородную фактуру.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выезд замерщика
✓ 3D-визуализация
✓ Расчёт сметы
            `;
            break;
        case 'multi':
            serviceDetail = `
<b>МНОГОУРОВНЕВЫЕ ПОТОЛКИ — АРХИТЕКТУРА СВЕТА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[1].price}

─────────────────────

<b>🎨 Что это такое?</b>

Многоуровневые потолки — это композиция из нескольких плоскостей, расположенных на разной высоте. Это не просто потолок, а полноценный архитектурный элемент, который кардинально меняет восприятие пространства.

<b>✨ Почему стоит выбрать многоуровневые потолки?</b>

🎯 <b>Зонирование</b> — визуально разделяем пространство на зоны без стен
📏 <b>Визуальное увеличение</b> — правильная игра света расширяет помещение
🎨 <b>Уникальный дизайн</b> — создаём эксклюзив, который нельзя купить в магазине
💡 <b>Подсветка</b> — встроенная LED-подсветка создаёт атмосферу

<b>🌟 Варианты реализации:</b>

• <b>Криволинейные формы</b> — волны, круги, плавные переходы
• <b>Геометрические фигуры</b> — квадраты, прямоугольники, ромбы
• <b>Комбинации фактур</b> — глянец + мат, разные цвета, фотопечать

<b>💡 Типы подсветки:</b>

🔹 <b>LED-лента</b> — экономичная, с пультом управления (цвет, яркость)
🔹 <b>Неоновая лента</b> — яркое равномерное свечение
🔹 <b>Дюралайт</b> — для контурной подсветки
🔹 <b>Споты</b> — точечное освещение с регулировкой угла

<b>🏆 Преимущества Потолкоф:</b>

🎨 <b>Собственная студия дизайна</b> — разработаем уникальный проект
📐 <b>Бесплатный 3D-проект</b> — увидите результат до монтажа
👨‍🎨 <b>Дизайнеры с опытом от 5 лет</b> — знаем, что модно и практично
✅ <b>Комплексная гарантия</b> — на полотно, установку, подсветку

<b>📐 Сроки реализации:</b>

• Дизайн-проект — 1-2 дня
• Монтаж — 3-5 дней (зависит от сложности)

─────────────────────

💡 <b>Совет эксперта:</b>

Многоуровневые потолки лучше всего подходят для помещений с высотой потолков от 2,7 метра. При меньшей высоте рекомендуем один уровень с имитацией глубины за счёт подсветки.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Авторский дизайн-проект
✓ 3D-визуализация (3-5 ракурсов)
✓ Выбор материалов в шоуруме
            `;
            break;
        case '3d':
            serviceDetail = `
<b>3D-ПОТОЛКИ С ФОТОПЕЧАТЬЮ — ИСКУССТВО НАД ГОЛОВОЙ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[2].price}

─────────────────────

<b>🎨 Что это такое?</b>

3D-потолки с фотопечатью — это реалистичное изображение любого сюжета на полотне потолка, которое создаёт эффект объёма и глубины. Это превращает обычный потолок в произведение искусства.

<b>✨ Что можно нанести?</b>

🌅 <b>Небо и облака</b> — классика, создаёт ощущение простора
🏔️ <b>Пейзажи</b> — горы, море, лес — уноситесь мечтами в путешествие
🎨 <b>Абстракции</b> — современные узоры, геометрия, цветовые переходы
👨‍👩‍👧 <b>Семейные фото</b> — лучшие моменты вашей жизни
🚀 <b>Фантазийные сюжеты</b> — космос, подводный мир, сказочные герои
🏢 <b>Корпоративная символика</b> — логотипы, брендирование для офисов

<b>🎭 Технические характеристики:</b>

🔹 <b>Разрешение печати</b> — до 1440 dpi — фотографическая чёткость
🔹 <b>Пигменты</b> — не выгорают на солнце, не тускнеют
🔹 <b>Стойкость</b> — к влаге, механическим воздействиям, УФ-излучению
🔹 <b>Безопасность</b> — экологически чистые чернила

<b>🏆 Почему Потолкоф?</b>

🖨️ <b>Собственное печатающее оборудование</b> — полный контроль качества
🎨 <b>Архив изображений</b> — 5000+ готовых сюжетов на выбор
👨‍🎨 <b>Дизайнеры</b> — создадим уникальный макет по вашему описанию
✅ <b>Тестовая печать</b> — утвердите образец до печати всего потолка

<b>📐 Особенности монтажа:</b>

• Тканевые потолки — ширина до 5 м без стыка
• ПВХ пленка — ширина до 3.2 м, бесшовная печать

─────────────────────

💡 <b>Совет эксперта:</b>

Для детских комнат рекомендуем сюжеты с мягкими, тёплыми цветами и позитивными образами. Избегайте слишком контрастных или агрессивных изображений — потолок должен успокаивать, а не возбуждать.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Подбор изображения из архива
✓ Создание макета по вашему описанию
✓ Тестовая печать фрагмента
            `;
            break;
        case 'photowall':
            serviceDetail = `
<b>ПОТОЛКИ С ФОТООБОЯМИ — БЮДЖЕТНОЕ РЕШЕНИЕ ДЛЯ ТВОРЧЕСТВА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[3].price}

─────────────────────

<b>🎨 Что это такое?</b>

Потолки с фотообоями — это натяжной потолок с нанесённым изображением, выполненным методом фотопечати на специальном полотне. Отличное решение для создания уникального интерьера по доступной цене.

<b>✨ Преимущества фотообоев:</b>

💰 <b>Доступная цена</b> — в 1.5-2 раза дешевле художественной росписи
🎨 <b>Любое изображение</b> — нанесём ваш рисунок или выберите из каталога
⚡ <b>Быстрый монтаж</b> — 1-2 дня после утверждения макета
🔧 <b>Ремонтопригодность</b> — при повреждении заменяем только часть полотна

<b>🎭 Темы для фотообоев:</b>

🌸 <b>Для детских</b> — мультики, животные, сказочные персонажи
🎯 <b>Для гостиной</b> — абстракции, классические узоры, пейзажи
🍳 <b>Для кухни</b> — натюрморты, фрукты, узоры в стиле прованс
💼 <b>Для офиса</b> — корпоративная символика, мотивационные цитаты

<b>🏆 Почему выбирают Потолкоф?</b>

🖨️ <b>Качественная печать</b> — 720 dpi, не выгорает
🎨 <b>Каталог изображений</b> — более 2000 вариантов на выбор
👨‍💻 <b>Дизайнеры</b> — подготовим ваш файл к печати
✅ <b>Гарантия</b> — 3 года на качество печати и монтаж

─────────────────────

💡 <b>Совет эксперта:</b>

При выборе изображения учитывайте освещение в помещении. На светлом фотообое светильники могут создавать блики, на тёмном — наоборот, скрывать фактуру. Лучше посоветоваться с дизайнером.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Подбор изображения из каталога
✓ Подготовка макета к печати
            `;
            break;
        case 'fabric':
            serviceDetail = `
<b>ТКАНЕВЫЕ ПОТОЛКИ — ЭЛИТА СРЕДИ НАТЯЖНЫХ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[4].price}

─────────────────────

<b>🎨 Что это такое?</b>

Тканевые потолки — это полотно из полимерной ткани, которое натягивается на каркас. В отличие от ПВХ пленки, ткань «дышит», пропускает воздух и создаёт ощущение натурального материала.

<b>✨ Преимущества тканевых потолков:</b>

🌬️ <b>Дышащий материал</b> — пропускает воздух, создаёт комфортный микроклимат
❄️ <b>Устойчивость к холоду</b> — можно монтировать при температуре до -15°C
🔨 <b>Прочность</b> — не рвётся при механических воздействиях
🎨 <b>Фактура</b> — приятная на ощупь, похожа на дорогие обои
🔥 <b>Безопасность</b> — при пожаре не выделяет токсичных веществ

<b>🎭 Особенности эксплуатации:</b>

• <b>Можно мыть</b> — мягкой губкой с неагрессивными средствами
• <b>Не притягивает пыль</b> — антистатические свойства
• <b>Не ржавеют</b> — устойчивость к влажности
• <b>Ремонтопригодны</b> — при порезе можно заклеить специальным клеем

<b>🏆 Почему выбирают Потолкоф?</b>

🏭 <b>Премиальные материалы</b> — работаем с Clipso, Descor, Cerutti
👨‍🔧 <b>Специализированные мастера</b> — монтаж только тканевых потолков
✅ <b>Гарантия</b> — 7 лет на монтаж и материал
🎁 <b>Крупноформатная печать</b> — ширина до 5 м без шва

<b>📐 Где лучше всего подходят:</b>

✓ Спальни — тёплая фактура, уютная атмосфера
✓ Детские — экологичные, безопасные материалы
✓ Нежилые помещения — лоджии, балконы, неотапливаемые комнаты

─────────────────────

💡 <b>Совет эксперта:</b>

Тканевые потолки идеально сочетаются с деревянной мебелью и классическим интерьером. Для современных минималистичных стилей выбирайте гладкие, матовые оттенки без яркого рисунка.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выбор материалов в шоуруме
✓ Образцы цветов и фактур на дом
            `;
            break;
        case 'satin':
            serviceDetail = `
<b>САТИНОВЫЕ ПОТОЛКИ — МЯГКАЯ БАРХАТИСТАЯ КРАСОТА</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Сатиновый потолок — это натяжной потолок с особой фактурой, которая находится посередине между матовым и глянцевым. Слегка перламутровый отлив, мягкое рассеивание света — это элегантность и understatement.

<b>✨ Преимущества сатиновых потолков:</b>

🌟 <b>Уникальная фактура</b> — мягкое свечение, перламутровый отлив
💡 <b>Рассеивание света</b> — нет ярких бликов, мягкое освещение
🎨 <b>Универсальность</b> — подходят к любому стиля интерьера
👀 <b>Визуальный эффект</b> — «дорогой» вид без высокой цены
🔧 <b>Маскировка</b> — скрывают неровности базового потолка

<b>🎭 Где особенно хорошо смотрятся:</b>

• <b>Спальни</b> — создают расслабляющую атмосферу
• <b>Гостиные</b> — элегантно, без вычурности
• <b>Прихожие</b> — не притягивают внимание к пыли
• <b>Офисы</b> — строго, профессионально

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>200+ оттенков</b> — от нежно-белого до тёмного графита
👨‍🔧 <b>Опытные мастера</b> — идеально натянутый потолок без складок
✅ <b>Гарантия</b> — 5 лет на монтаж и материал
💎 <b>Премиум качество</b> — работаем только с проверенными поставщиками

<b>📐 Технические характеристики:</b>

• Ширина рулона — 1.3 – 3.2 м
• Толщина полотна — 0.17-0.19 мм
• Прочность на разрыв — 130 кг/см²

─────────────────────

💡 <b>Совет эксперта:</b>

Сатиновый потолок — лучший выбор для спален, так как он не создаёт бликов от ночников или лунного света. Нежный перламутровый отлив визуально делает потолок выше, что особенно важно для комнат с высотой до 2.5 метра.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Образцы цветов
✓ Виртуальная визуализация в вашем интерьере
            `;
            break;
        case 'glossy':
            serviceDetail = `
<b>ГЛЯНЦЕВЫЕ ПОТОЛКИ — ЗЕРКАЛЬНЫЙ ЭФФЕКТ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Глянцевый потолок — это натяжной потолок с зеркальной поверхностью, который отражает свет и окружающее пространство, создавая визуальный эффект увеличения высоты помещения.

<b>✨ Преимущества глянцевых потолков:</b>

🪞 <b>Зеркальный эффект</b> — визуально увеличивают высоту на 20-30%
💡 <b>Отражение света</b> — делают помещение светлее без дополнительных светильников
🎨 <b>Яркость и насыщенность</b> — глубокие, сочные цвета
🧼 <b>Лёгкая очистка</b> — легко моются, не впитывают запахи
💎 <b>Эффектность</b> — выглядят дорого и современно

<b>🎭 Особенности использования:</b>

• <b>Идеальны для небольших помещений</b> — визуально расширяют
• <b>Подходят для помещений с хорошим освещением</b> — подчёркивают игру света
• <b>Требуют аккуратности</b> — видны пыль, отпечатки, царапины
• <b>Лучше в светлых оттенках</b> — белый, молочный, слоновая кость

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>Премиальные материалы</b> — глянец без дефектов, идеально ровный
👨‍🔧 <b>Эксперты по глянцу</b> — знаем секреты идеального монтажа
✅ <b>Гарантия</b> — 5 лет, дополнительно — обслуживание
💎 <b>Контроль качества</b> — проверяем каждое полотно перед установкой

<b>📐 Где лучше всего подходят:</b>

✓ Небольшие коридоры — визуальное увеличение
✓ Кухни — легко моются, светло
✓ Ванные — зеркальный эффект, влагостойкость
✓ Гостиные с хорошим освещением — подчёркивают свет

⚠️ <b>Где не рекомендуем:</b>

✗ Спальни — блики могут мешать сну
✗ Помещения с плохим освещением — будут выглядеть тускло

─────────────────────

💡 <b>Совет эксперта:</b>

Для глянцевого потолка выбирайте максимально светлый оттенок — белый, молочный или светло-бежевый. Тёмные оттенки визуально «давят», отражая тёмные оттенки стен и мебели. Идеальная комбинация — белый глянцевый потолок + светлые стены.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Выбор оттенков из каталога
✓ Образцы на дом
✓ Консультация по освещению
            `;
            break;
        case 'matte':
            serviceDetail = `
<b>МАТОВЫЕ ПОТОЛКИ — КЛАССИКА И УНИВЕРСАЛЬНОСТЬ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

<b>🎨 Что это такое?</b>

Матовый потолок — это натяжной потолок с шероховатой поверхностью, которая не отражает свет. Это классическое решение, которое подходит к любому интерьеру и никогда не выходит из моды.

<b>✨ Преимущества матовых потолков:</b>

🌫️ <b>Нет бликов</b> — идеально ровное рассеивание света
🎨 <b>Универсальность</b> — подходят к любому стилю и цвету стен
👀 <b>Визуальный комфорт</b> — не отвлекают, создают уют
🧼 <b>Лёгкий уход</b> — мягкая губка с неагрессивным средством
🔧 <b>Маскировка</b> — скрывают все неровности базового потолка

<b>🎭 Особенности:</b>

• <b>Широкая палитра</b> — более 400 оттенков
• <b>Текстура</b> — приятная на ощупь, напоминает качественную штукатурку
• <b>Стойкость</b> — не выгорают, не желтеют со временем
• <b>Безопасность</b> — экологичные материалы, не токсичны

<b>🏆 Почему выбирают Потолкоф?</b>

🎨 <b>Сертифицированные материалы</b> — только проверённые поставщики
👨‍🔧 <b>Опытные мастера</b> — более 5000 установок матовых потолков
✅ <b>Гарантия</b> — 5 лет на монтаж и материал
💎 <b>Контроль качества</b> — проверяем перед установкой

<b>📐 Идеально подходят для:</b>

✓ Спален — отсутствие бликов, спокойный цвет
✓ Детских — безопасность, экологичность
✓ Офисов — строго, профессионально
✓ Классических интерьеров — безупречно сочетаются

<b>🎭 Цвета для разных помещений:</b>

• <b>Спальни</b> — нежные пастельные, молочный, светло-бежевый
• <b>Гостиные</b> — классический белый, кремовый, слоновая кость
• <b>Детские</b> — нежные голубые, розовые, мятные
• <b>Офисы</b> — белый, серый, графит

─────────────────────

💡 <b>Совет эксперта:</b>

Матовый потолок — это безопасный выбор, который никогда не разочарует. Если вы не уверены, какой потолок выбрать, начинайте с матового белого — это беспроигрышный вариант, который смотрится дорого и благородно.

─────────────────────

🎁 <b>Бесплатно при заказе:</b>

✓ Образцы цветов
✓ Выбор оттенков с учётом вашего интерьера
✓ Консультация дизайнера
            `;
            break;
        default:
            serviceDetail = 'Уточните информацию об этой услуге у нашего менеджера.';
    }

    ctx.editMessageText(serviceDetail, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📏 Заказать замер', callback_data: 'request_call' },
                    { text: '💬 Написать в Telegram', url: `https://t.me/${companyInfo.contacts.telegram.replace('@', '')}` }
                ],
                [
                    { text: '📐 Калькулятор', callback_data: 'calculator' },
                    { text: '💰 Цены', callback_data: 'prices' }
                ],
                [
                    { text: '◀️ Назад', callback_data: 'ceiling_menu' },
                    { text: '🏠 Главное меню', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});


// Обработка остановки процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));