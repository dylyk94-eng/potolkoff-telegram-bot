const https = require('https');

const token = '8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0';

// Удаляем webhook
https.get('https://api.telegram.org/bot' + token + '/deleteWebhook', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Webhook удалён:');
        console.log(data);
    });
}).on('error', (e) => console.error(e));
