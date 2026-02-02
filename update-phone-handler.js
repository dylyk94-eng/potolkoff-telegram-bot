// Скрипт для обновления bot.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'bot.js');
const oldHandler = `bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(\`
📞 НАШ ТЕЛЕФОН

─────────────────────

${companyInfo.contacts.phone}

─────────────────────

🕒 РАБОЧЕЕ ВРЕМЯ:
Пн-Пт: 9:00 - 18:00
Сб-Вс: выходной

─────────────────────

💡 Если мы не ответили - напишите нам в Telegram!
    \`);
});`;

const newHandler = `bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    
    const phoneNumber = companyInfo.contacts.phone;
    const sharePhone = phoneNumber.replace(/\\s/g, '').replace(/\\(/g, '').replace(/\\)/g, '');
    const shareText = encodeURIComponent('Здравствуйте, это Потолкоф!');
    const shareUrl = 'https://t.me/share?url=' + sharePhone + '&text=' + shareText;
    const telegramUrl = 'https://t.me/' + companyInfo.contacts.telegram.replace('@', '');
    
    ctx.reply(
\`📞 НАШ ТЕЛЕФОН

─────────────────────

\${phoneNumber}

─────────────────────

🕒 РАБОЧЕЕ ВРЕМЯ:
Пн-Пт: 9:00 - 18:00
Сб-Вс: выходной

─────────────────────

📞 НУЖЕН ЗВОНОК?
Нажмите кнопку ниже ⬇️
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
});`;

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        process.exit(1);
    }
    
    if (data.includes(oldHandler)) {
        // Заменяем старый обработчик на новый
        const newContent = data.replace(oldHandler, newHandler);
        
        fs.writeFile(filePath, newContent, 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing file:', writeErr);
                process.exit(1);
            }
            console.log('Successfully updated bot.js with new phone handler!');
        });
    } else {
        console.log('Old handler not found in file');
        process.exit(1);
    }
});
