// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== API KEYS DARI .ENV ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('========================================');
console.log('🚀 Youz AI Server Starting...');
console.log('========================================');
console.log(`📌 OpenAI API Key : ${OPENAI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log(`📌 Gemini API Key : ${GEMINI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log(`🌐 Port           : ${PORT}`);
console.log('========================================\n');

// System prompt
const SYSTEM_PROMPT = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik dan benar.`;

// ========== HELPER: SAFE FETCH ==========
async function safeFetch(url, options) {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type') || '';
        
        // Baca response sebagai text dulu
        const textResponse = await response.text();
        
        if (!response.ok) {
            try {
                const errorJson = JSON.parse(textResponse);
                throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
            } catch (e) {
                if (textResponse.includes('<html>') || textResponse.includes('<!DOCTYPE')) {
                    throw new Error(`API Error (${response.status}): Server returned HTML instead of JSON`);
                }
                throw new Error(`API Error (${response.status}): ${textResponse.substring(0, 100)}`);
            }
        }
        
        try {
            return JSON.parse(textResponse);
        } catch (e) {
            console.error('❌ JSON Parse Error:', e.message);
            throw new Error('Invalid JSON response from API');
        }
        
    } catch (error) {
        console.error('❌ Fetch Error:', error.message);
        throw error;
    }
}

// ========== OPENAI ENDPOINT ==========
app.post('/api/openai/chat', async (req, res) => {
    try {
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ success: false, error: 'OpenAI API Key tidak dikonfigurasi' });
        }

        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, error: 'Format messages tidak valid' });
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        console.log(`📤 [OpenAI] Mengirim request...`);

        const data = await safeFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: fullMessages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        console.log(`✅ [OpenAI] Response diterima`);

        res.json({ 
            success: true, 
            content: data.choices?.[0]?.message?.content || '(Tidak ada respons)',
            model: 'openai'
        });

    } catch (error) {
        console.error('❌ [OpenAI] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GEMINI ENDPOINT ==========
app.post('/api/gemini/chat', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: 'Gemini API Key tidak dikonfigurasi' });
        }

        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, error: 'Format messages tidak valid' });
        }

        let prompt = `${SYSTEM_PROMPT}\n\n`;
        for (const msg of messages) {
            if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Youz AI: ${msg.content}\n`;
            }
        }
        prompt += 'Youz AI: ';

        console.log(`📤 [Gemini] Mengirim request...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const data = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
            })
        });

        console.log(`✅ [Gemini] Response diterima`);

        res.json({ 
            success: true, 
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '(Tidak ada respons)',
            model: 'gemini'
        });

    } catch (error) {
        console.error('❌ [Gemini] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GEMINI VISION ==========
app.post('/api/gemini/vision', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: 'Gemini API Key tidak dikonfigurasi' });
        }

        const { imageData, prompt } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ success: false, error: 'Data gambar tidak ditemukan' });
        }

        console.log(`📤 [Gemini Vision] Menganalisis gambar...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        
        const data = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt || 'Deskripsikan gambar ini secara detail dalam Bahasa Indonesia.' },
                        { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                    ]
                }]
            })
        });

        console.log(`✅ [Gemini Vision] Analisis selesai`);

        res.json({ 
            success: true, 
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '(Tidak dapat menganalisis gambar)'
        });

    } catch (error) {
        console.error('❌ [Gemini Vision] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        openai: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ========== SERVE FRONTEND ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`✨ Youz AI Server berjalan di http://localhost:${PORT}`);
    console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});
