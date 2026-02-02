const { exec } = require('child_process');

// Ищем все процессы node с bot.js
exec('tasklist /FI "IMAGENAME eq node.exe" /FO LIST /V', (error, stdout, stderr) => {
    if (error) {
        console.error('Ошибка:', error);
        return;
    }

    const lines = stdout.split('\n');
    console.log('Поиск bot.js в процессах node...\n');

    lines.forEach(line => {
        if (line.toLowerCase().includes('bot.js')) {
            console.log('НАЙДЕН bot.js:', line.trim());
        }
    });

    console.log('\nЕсли bot.js найден выше - нужно остановить этот процесс');
});
