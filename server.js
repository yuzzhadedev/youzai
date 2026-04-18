// Load environment variables dari file .env
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

// ========== AMBIL API KEY DARI .ENV ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validasi API Key saat startup
console.log('========================================');
console.log('🚀 Youz AI Server Starting...');
console.log('========================================');
console.log(`📌 OpenAI API Key : ${OPENAI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada (isi .env)'}`);
console.log(`📌 Gemini API Key : ${GEMINI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada (isi .env)'}`);
console.log(`🌐 Port           : ${PORT}`);
console.log('========================================\n');

// System prompt untuk identitas Youz AI
const SYSTEM_PROMPT = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. 
Kamu dibuat oleh Developer Yuzz Ofc. 
Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik dan benar.
Kamu bisa membantu berbagai hal: coding, menulis, analisis, diskusi, dan lain-lain.
Jawablah pertanyaan pengguna dengan tepat, akurat, dan bermanfaat.`;

// ========== OPENAI ENDPOINT ==========
app.post('/api/openai/chat', async (req, res) => {
    try {
        // Validasi API Key
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'OpenAI API Key tidak dikonfigurasi di server' 
            });
        }

        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format messages tidak valid' 
            });
        }

        // Tambahkan system prompt di awal
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        console.log(`📤 [OpenAI] Mengirim request...`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: fullMessages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        // Cek content-type response
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } else {
                const textError = await response.text();
                console.error('OpenAI non-JSON error:', textError);
                errorMessage = 'OpenAI API error (non-JSON response)';
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        console.log(`✅ [OpenAI] Response diterima`);

        res.json({ 
            success: true, 
            content: data.choices[0].message.content,
            model: 'openai'
        });

    } catch (error) {
        console.error('❌ [OpenAI] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== GEMINI ENDPOINT ==========
app.post('/api/gemini/chat', async (req, res) => {
    try {
        // Validasi API Key
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Gemini API Key tidak dikonfigurasi di server' 
            });
        }

        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format messages tidak valid' 
            });
        }

        // Gabungkan pesan menjadi satu prompt dengan konteks
        let prompt = `${SYSTEM_PROMPT}\n\n`;
        
        // Tambahkan riwayat percakapan
        for (const msg of messages) {
            if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Youz AI: ${msg.content}\n`;
            }
        }
        prompt += 'Youz AI: ';

        console.log(`📤 [Gemini] Mengirim request...`);

        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000
                }
            })
        });

        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } else {
                const textError = await response.text();
                console.error('Gemini non-JSON error:', textError);
                errorMessage = 'Gemini API error (non-JSON response)';
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        console.log(`✅ [Gemini] Response diterima`);

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '(Tidak ada respons)';

        res.json({ 
            success: true, 
            content: content,
            model: 'gemini'
        });

    } catch (error) {
        console.error('❌ [Gemini] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== GEMINI VISION (Analisis Gambar) ==========
app.post('/api/gemini/vision', async (req, res) => {
    try {
        // Validasi API Key
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Gemini API Key tidak dikonfigurasi di server' 
            });
        }

        const { imageData, prompt } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false, 
                error: 'Data gambar tidak ditemukan' 
            });
        }

        console.log(`📤 [Gemini Vision] Menganalisis gambar...`);

        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        // Hapus prefix data:image/xxx;base64,
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        
        const response = await fetch(url, {
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

        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } else {
                const textError = await response.text();
                console.error('Gemini Vision non-JSON error:', textError);
                errorMessage = 'Gemini Vision API error (non-JSON response)';
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        console.log(`✅ [Gemini Vision] Analisis selesai`);

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '(Tidak dapat menganalisis gambar)';

        res.json({ 
            success: true, 
            content: content 
        });

    } catch (error) {
        console.error('❌ [Gemini Vision] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
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
    console.log('========================================\n');
});
