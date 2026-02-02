// Фиксированный обработчик для телефона с кнопкой "Поделиться в Telegram"

bot.action('phone', (ctx) => {
    ctx.answerCbQuery();
    
    const phoneNumber = companyInfo.contacts.phone;
    const sharePhone = phoneNumber.replace(/\s/g, '').replace(/\(/g, '').replace(/\)/g, '');
    const shareText = encodeURIComponent('Здравствуйте, это Потолкоф!');
    const shareUrl = `https://t.me/share/url?url=${sharePhone}&text=${shareText}`;
    const telegramUrl = `https://t.me/${companyInfo.contacts.telegram.replace('@', '')}`;
    
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
