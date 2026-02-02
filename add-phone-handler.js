// Скрипт для добавления обработчика телефона с кнопками
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'bot.js');

// Читаем весь файл
fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        process.exit(1);
    }
    
    // Разделяем файл на части: до bot.action('phone') и после
    const lines = data.split('\n');
    let beforePhone = [];
    let afterPhone = [];
    let foundPhone = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("bot.action('phone',")) {
            foundPhone = true;
            continue;
        }
        if (!foundPhone) {
            beforePhone.push(lines[i]);
        } else {
            afterPhone.push(lines[i]);
        }
    }
    
    if (!foundPhone) {
        console.log('bot.action(phone not found in file');
        process.exit(1);
    }
    
    // Новый обработчик телефона
    const newHandler = `
// Обработчик телефона с кнопками "Написать в Telegram" и "Поделиться"
bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    
    const phoneNumber = '+7 (983) 420-88-05';
    const sharePhone = phoneNumber.replace(/\\s/g, '').replace(/\\(/g, '').replace(/\\)/g, '');
    const shareText = encodeURIComponent('Здравствуйте, это Потолкоф!');
    const shareUrl = 'https://t.me/share?url=' + sharePhone + '&text=' + shareText;
    const telegramUrl = 'https://t.me/potolkoff2024';
    
    ctx.reply(
\`📞 НАШ ТЕЛЕФОН

─────────────────────

\${phoneNumber}

─────────────────────

🕒 РАБОЧЕЕ ВРЕМЯ:
Пн-Пт: 9:00 - 18:00
Сб-Вс: выходной

─────────────────────

💡 Если мы не ответили - напишите нам в Telegram!
    \`, {
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
`;
    
    // Объединяем
    const newContent = beforePhone.join('\n') + newHandler + afterPhone.join('\n');
    
    // Записываем
    fs.writeFile(filePath, newContent, 'utf8', (writeErr) => {
        if (writeErr) {
            console.error('Error writing file:', writeErr);
            process.exit(1);
        }
        console.log('Successfully updated bot.js with new phone handler!');
        console.log('Added buttons: "Написать в Telegram" and "Поделиться"');
    });
});
