const https = require('https');

async function testHttps() {
    try {
        console.log('=== Testowanie HTTPS ===');
        
        // Test prostego zapytania
        const response = await new Promise((resolve, reject) => {
            const req = https.get('https://firestore.googleapis.com/v1/projects/coachay-5c3c9/databases/(default)/documents/trainers', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
        
        console.log('Status:', response.statusCode);
        console.log('Headers:', response.headers);
        console.log('Body length:', response.body.length);
        console.log('Body preview:', response.body.substring(0, 200) + '...');
        
        if (response.statusCode === 200) {
            try {
                const data = JSON.parse(response.body);
                console.log('Documents count:', data.documents ? data.documents.length : 0);
                
                if (data.documents && data.documents.length > 0) {
                    const trainer = data.documents[0].fields;
                    console.log('Found trainer:', trainer.displayName?.stringValue);
                }
            } catch (e) {
                console.log('JSON parse error:', e.message);
            }
        }
        
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testHttps();
