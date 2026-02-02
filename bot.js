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
                { text: '📞 Контакты', callback_data: 'contacts' },
                { text: '💼 Услуги', callback_data: 'services' }
            ],
            [
                { text: 'ℹ️ О нас', callback_data: 'about' },
                { text: '📊 Статистика', callback_data: 'stats' }
            ],
            [
                { text: '🎯 Получить консультацию', callback_data: 'consultation' }
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
                { text: 'Ремонт "под ключ"', callback_data: 'service_repair' }
            ],
            [
                { text: 'Дизайн интерьеров', callback_data: 'service_design' }
            ],
            [
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

// Создаем Stage для сцен
const stage = new Scenes.Stage([requestScene]);

// Middleware для сессий
bot.use(session());

// Подключаем stage
bot.use(stage.middleware());

// Приветственное сообщение
const welcomeMessage = `
🎉 Добро пожаловать в ${companyInfo.name}!

${companyInfo.fullName}
"${companyInfo.slogan}"

Мы специализируемся на:
• Натяжных потолках премиум-класса
• Ремонте "под ключ"
• Дизайне интерьеров

Нажмите кнопки ниже, чтобы узнать больше о наших услугах и связаться с нами.
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

bot.action('contacts', (ctx) => {
    const contactMessage = `
📞 Наши контакты:

Телефон: ${companyInfo.contacts.phone}
Telegram: ${companyInfo.contacts.telegram}
VK: ${companyInfo.contacts.vk}
Instagram: ${companyInfo.contacts.instagram}

Выберите удобный способ связи:
    `;
    ctx.editMessageText(contactMessage, contactsMenu);
});

bot.action('services', (ctx) => {
    let servicesMessage = '💼 Наши услуги:\n\n';
    companyInfo.services.forEach((service, index) => {
        servicesMessage += `${index + 1}. <b>${service.name}</b>\n   Цена: ${service.price}\n\n`;
    });
    servicesMessage += 'Хотите узнать подробнее об одной из услуг?';
    
    ctx.editMessageText(servicesMessage, servicesMenu);
});

bot.action('about', (ctx) => {
    let aboutMessage = `
ℹ️ О компании ${companyInfo.name}

${companyInfo.fullName} - это команда профессионалов, которая уже более ${companyInfo.stats.experience} лет создает уют и комфорт в домах и квартирах Улан-Удэ.

✨ Наши преимущества:
    `;
    companyInfo.features.forEach(feature => {
        aboutMessage += `• ${feature}\n`;
    });
    
    aboutMessage += `\n${companyInfo.slogan}`;
    
    ctx.editMessageText(aboutMessage, mainMenu);
});

bot.action('stats', (ctx) => {
    const statsMessage = `
📊 Наша статистика:

• Объектов выполнено: ${companyInfo.stats.objects}
• Довольных клиентов: ${companyInfo.stats.clients}+
• Лет на рынке: ${companyInfo.stats.experience}
• Уровень удовлетворенности: ${companyInfo.stats.satisfaction}

Мы гордимся качеством нашей работы и благодарны каждому клиенту!
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
<b>Натяжные потолки</b>

Цена: от ${companyInfo.services[0].price}

✨ Преимущества:
• Быстрый монтаж (1-2 дня)
• Водонепроницаемость
• Разнообразие фактур и цветов
• Гарантия качества
• Экономичное освещение

Идеальное решение для любого помещения!
            `;
            break;
        case 'multi':
            serviceDetail = `
<b>Многоуровневые потолки</b>

Цена: от ${companyInfo.services[1].price}

🌟 Особенности:
• Современный дизайн
• Подсветка разных уровней
• Визуальное увеличение пространства
• Индивидуальные решения

Создаем уникальный образ вашего интерьера!
            `;
            break;
        case '3d':
            serviceDetail = `
<b>3D-потолки с фотопечатью</b>

Цена: от ${companyInfo.services[2].price}

🎨 Возможности:
• Фотопечать высокого качества
• Любой дизайн по вашему желанию
• Объемный эффект
• Уникальность решения

Превращаем потолок в произведение искусства!
            `;
            break;
        case 'repair':
            serviceDetail = `
<b>Ремонт "под ключ"</b>

Цена: по запросу

🏠 Что входит:
• Полный комплекс работ
• От demolition до финальной отделки
• Авторский надзор
• Гарантия на все работы

Превращаем любую квартиру в мечту!
            `;
            break;
        case 'design':
            serviceDetail = `
<b>Дизайн интерьеров</b>

Цена: по запросу

✨ Услуги:
• Разработка концепции
• Планировочные решения
• 3D-визуализация
• Авторский надзор

Создаем пространство, которое радует глаз!
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