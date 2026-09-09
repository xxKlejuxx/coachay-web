/**
 * verify_email_manual.js — ręczna weryfikacja emaila przez Admin SDK
 * Uruchom: cd functions && node verify_email_manual.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'coachay-5c3c9' });

(async () => {
    const uid = 'n11dk6SMEcbNsvlI3HZ4GeESiQI3';
    await admin.auth().updateUser(uid, { emailVerified: true });
    console.log('✅ emailVerified ustawiony na true dla:', uid);
    process.exit(0);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
