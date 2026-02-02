const https = require('https');

const token = '8581860319:AAGf7dr3o2XIKZePqDocpM0_W0_0HX0MZt0';

// Проверяем updates
https.get('https://api.telegram.org/bot' + token + '/getUpdates', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('getUpdates результат:');
        console.log(data);
    });
}).on('error', (e) => console.error(e));
