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
📅 Желаемая дата: ${request.data.datetime}
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
        ctx.reply('📋 Шаг 1 из 6\n\nВыберите услугу:', serviceKeyboard);
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
            ctx.reply(`📋 Шаг 2 из 6\n\nВыбранная услуга: ${ctx.session.request.service}\n\nВведите площадь помещения (в м²):`);
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
                ctx.reply(`📋 Шаг 3 из 6\n\nПлощадь: ${ctx.session.request.area} м²\n\nВведите адрес для замера:`);
            } else {
                ctx.reply('Пожалуйста, введите корректное число (площадь в м²).');
            }
        } else {
            ctx.reply('Пожалуйста, введите площадь числом.');
        }
        return ctx.wizard.next();
    },
    // Шаг 4: Выбор даты и времени
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const address = ctx.message.text.trim();
            if (address.length > 5) {
                ctx.session.request.address = address;
                const datetimeKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Сегодня', callback_data: 'req_dt_today' },
                                { text: 'Завтра', callback_data: 'req_dt_tomorrow' }
                            ],
                            [
                                { text: 'На этой неделе', callback_data: 'req_dt_week' },
                                { text: 'На следующей неделе', callback_data: 'req_dt_nextweek' }
                            ],
                            [
                                { text: '✍️ Ввести дату вручную', callback_data: 'req_dt_manual' }
                            ]
                        ]
                    }
                };
                ctx.reply(`📋 Шаг 4 из 6\n\nАдрес: ${ctx.session.request.address}\n\nВыберите удобную дату для замера:`, datetimeKeyboard);
            } else {
                ctx.reply('Пожалуйста, введите полный адрес (минимум 5 символов).');
            }
        }
        return ctx.wizard.next();
    },
    // Шаг 5: Ввод контактов
    (ctx) => {
        if (ctx.callbackQuery) {
            const action = ctx.callbackQuery.data.split('_')[2];
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

            switch(action) {
                case 'today':
                    ctx.session.request.datetime = `Сегодня, ${now.toLocaleDateString('ru-RU', options)}`;
                    break;
                case 'tomorrow':
                    now.setDate(now.getDate() + 1);
                    ctx.session.request.datetime = `Завтра, ${now.toLocaleDateString('ru-RU', options)}`;
                    break;
                case 'week':
                    ctx.session.request.datetime = 'На этой неделе';
                    break;
                case 'nextweek':
                    ctx.session.request.datetime = 'На следующей неделе';
                    break;
                case 'manual':
                    ctx.session.request.datetime = '';
                    ctx.answerCbQuery();
                    ctx.reply('📋 Шаг 4 из 6 (продолжение)\n\nВведите желаемую дату и время для замера (например: "15 февраля в 14:00"):');
                    return ctx.wizard.next(); // Пропускаем следующий шаг, ждем ввода даты
            }
            ctx.answerCbQuery();
            ctx.reply(`📋 Шаг 5 из 6\n\nДата: ${ctx.session.request.datetime}\n\nВведите ваше имя и номер телефона:\nНапример: Иван, +7 (983) 123-45-67`);
            return ctx.wizard.next();
        } else {
            ctx.reply('Пожалуйста, выберите вариант из предложенных.');
        }
        return ctx.wizard.next();
    },
    // Шаг 5.1: Ввод даты вручную
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const datetime = ctx.message.text.trim();
            if (datetime.length > 3) {
                ctx.session.request.datetime = datetime;
                ctx.reply(`📋 Шаг 5 из 6\n\nДата: ${ctx.session.request.datetime}\n\nВведите ваше имя и номер телефона:\nНапример: Иван, +7 (983) 123-45-67`);
                return ctx.wizard.next();
            }
        }
        ctx.reply('Пожалуйста, введите корректную дату.');
    },
    // Шаг 6: Комментарий (опционально)
    (ctx) => {
        if (ctx.message && ctx.message.text) {
            const contacts = ctx.message.text.trim();
            if (contacts.length > 5) {
                ctx.session.request.contacts = contacts;
                ctx.reply(`📋 Шаг 6 из 6\n\nКонтакты: ${ctx.session.request.contacts}\n\nДобавьте комментарий к заявке (необязательно) или напишите "Пропустить":`);
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
📅 Дата: ${ctx.session.request.datetime}
👤 Контакты: ${ctx.session.request.contacts}
💬 Комментарий: ${ctx.session.request.comment || 'Нет'}
            `;

            ctx.reply(summary, confirmKeyboard);
        }
    }
);

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
                { text: '📞 Заказать звонок', callback_data: 'request_call' },
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
                                { text: '📞 Заказать звонок', callback_data: 'request_call' }
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

// Приветственное сообщение
const welcomeMessage = `
🎉 Добро пожаловать в ${companyInfo.name}!

${companyInfo.fullName}
"${companyInfo.slogan}"

─────────────────────

✨ Мы специализируемся на:
• Натяжных потолках премиум-класса
• Многоуровневых конструкциях с подсветкой
• Ремонте "под ключ"
• Дизайне интерьеров

─────────────────────

📐 Рассчитайте стоимость через калькулятор
📞 Закажите бесплатный замер
🏗️ Посмотрите наши работы

👇 Выберите интересующий раздел:
`;

// Запуск бота
bot.start((ctx) => {
    ctx.reply(welcomeMessage, mainMenu);
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
Используйте калькулятор или закажите звонок!
    `;

    ctx.editMessageText(pricesMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📐 Рассчитать', callback_data: 'calculator' },
                    { text: '📞 Заказать звонок', callback_data: 'request_call' }
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
                    { text: '🎥 Видеообзоры', url: 'https://vk.com/potolkoff03' }
                ],
                [
                    { text: '💬 Отзывы клиентов', url: 'https://vk.com/potolkoff03' }
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

bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(`
📞 НАШ ТЕЛЕФОН

─────────────────────

${companyInfo.contacts.phone}

─────────────────────

🕒 Позвоните в рабочее время:
Пн-Пт: 9:00 - 18:00

💡 Если мы не ответили - напишите нам в Telegram!
    `);
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
bot.action(/^service_/, (ctx) => {
    const serviceCode = ctx.callbackQuery.data.split('_')[1];
    let serviceDetail = '';

    switch(serviceCode) {
        case 'ceiling':
            serviceDetail = `
<b>НАТЯЖНЫЕ ПОТОЛКИ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[0].price}

─────────────────────

✨ ПРЕИМУЩЕСТВА:
⚡ Быстрый монтаж (1-2 дня)
💧 Водонепроницаемость
🎨 Разнообразие фактур и цветов
✅ Гарантия качества
💡 Экономичное освещение

─────────────────────

🏠 ИДЕАЛЬНО ДЛЯ:
• Квартир и домов
• Офисов и коммерческих помещений
• Ванных комнат и кухонь

─────────────────────

💬 Хотите узнать больше?
Закажите консультацию!
            `;
            break;
        case 'multi':
            serviceDetail = `
<b>МНОГОУРОВНЕВЫЕ ПОТОЛКИ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[1].price}

─────────────────────

🌟 ОСОБЕННОСТИ:
🎨 Современный дизайн
💡 Подсветка разных уровней
📐 Визуальное увеличение пространства
🎯 Индивидуальные решения

─────────────────────

✅ ПРЕИМУЩЕСТВА:
• Уникальный образ интерьера
• Скрытие коммуникаций
• Зонирование пространства
• Роскошный внешний вид

─────────────────────

🎁 ОФЕРТА:
Бесплатный 3D-проект при заказе!
            `;
            break;
        case '3d':
            serviceDetail = `
<b>3D-ПОТОЛКИ С ФОТОПЕЧАТЬЮ</b>

─────────────────────

💰 Цена: от ${companyInfo.services[2].price}

─────────────────────

🎨 ВОЗМОЖНОСТИ:
📷 Фотопечать высокого качества
🎨 Любой дизайн по вашему желанию
🌟 Объемный эффект
✨ Уникальность решения

─────────────────────

✨ ГДЕ ИСПОЛЬЗОВАТЬ:
• Детские комнаты
• Спальни
• Гостиные
• Игровые зоны

─────────────────────

🎁 ПРЕДЛОЖЕНИЕ:
Принесите свою картинку - сделаем!
            `;
            break;
        case 'repair':
            serviceDetail = `
<b>РЕМОНТ "ПОД КЛЮЧ"</b>

─────────────────────

💰 Цена: по запросу

─────────────────────

🏠 ЧТО ВХОДИТ:
🔨 Полный комплекс работ
🏗️ От demolition до финальной отделки
👷 Авторский надзор
✅ Гарантия на все работы

─────────────────────

📋 ЭТАПЫ РАБОТ:
1️⃣ Проектирование и расчёт
2️⃣ Демонтажные работы
3️⃣ Черновая отделка
4️⃣ Чистовая отделка
5️⃣ Мебель и декор

─────────────────────

🎁 БОНУС:
Бесплатный выезд на замер!
            `;
            break;
        case 'design':
            serviceDetail = `
<b>ДИЗАЙН ИНТЕРЬЕРОВ</b>

─────────────────────

💰 Цена: по запросу

─────────────────────

✨ УСЛУГИ:
🎨 Разработка концепции
📐 Планировочные решения
🎬 3D-визуализация
👷 Авторский надзор

─────────────────────

💼 ЧТО ПОЛУЧИТЕ:
• Индивидуальный дизайн
• Фотореалистичные 3D-рендеры
• Подбор материалов
• Расчёт сметы

─────────────────────

🎁 ОФЕРТА:
Первое посещение бесплатно!
            `;
            break;
        case 'photowall':
            serviceDetail = `
<b>Потолки с фотообоями</b>

Цена: от ${companyInfo.services[3].price}

🖼️ Особенности:
• Фотопечать высокого качества
• Любой дизайн по вашему желанию
• Объемный эффект
• Влагостойкость

Создаем уникальный интерьер по вашим фото!
            `;
            break;
        case 'fabric':
            serviceDetail = `
<b>Тканевые потолки</b>

Цена: от ${companyInfo.services[4].price}

🌟 Преимущества:
• Экологичные материалы
• Долговечность
• Широкая цветовая гамма
• Безопасны для здоровья

Идеальны для детских и спален!
            `;
            break;
        case 'satin':
            serviceDetail = `
<b>Сатиновые потолки</b>

Цена: от ${companyInfo.services[0].price}

✨ Особенности:
• Бархатистая текстура
• Рассеивают свет
• Не создают бликов
• Нейтральные оттенки

Отличное решение для жилых комнат!
            `;
            break;
        case 'glossy':
            serviceDetail = `
<b>Глянцевые потолки</b>

Цена: от ${companyInfo.services[0].price}

✨ Преимущества:
• Зеркальный эффект
• Визуально увеличивают пространство
• Яркий и блестящий вид
• Легкая очистка

Отличны для небольших помещений!
            `;
            break;
        case 'matte':
            serviceDetail = `
<b>Матовые потолки</b>

Цена: от ${companyInfo.services[0].price}

🌟 Особенности:
• Классический внешний вид
• Нейтральные оттенки
• Устойчивы к истиранию
• Долговечность

Универсальное решение для любого интерьера!
            `;
            break;
        default:
            serviceDetail = 'Уточните информацию об этой услуге у нашего менеджера.';
    }

    ctx.editMessageText(serviceDetail, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📞 Получить расчет', url: `tel:${companyInfo.contacts.phone.replace(/\s/g, '')}` },
                    { text: '💬 Написать в Telegram', url: `https://t.me/${companyInfo.contacts.telegram.replace('@', '')}` }
                ],
                [
                    { text: '◀️ Назад к услугам', callback_data: 'services' },
                    { text: '🏠 Главное меню', callback_data: 'main_menu' }
                ]
            ]
        }
    });
});

// Запуск бота
bot.launch()
    .then(() => {
        console.log('Telegram бот запущен успешно!');
    })
    .catch(err => {
        console.error('Ошибка при запуске бота:', err);
    });

// Обработка остановки процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));