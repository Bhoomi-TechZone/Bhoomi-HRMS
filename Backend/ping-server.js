const http = require('http');

http.get('https://estrogen-fabric-synthesis.ngrok-free.dev/api/salary-rules', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log(`BODY: ${data.substring(0, 100)}`);
    });
}).on('error', (err) => {
    console.error(`Error: ${err.message}`);
});
