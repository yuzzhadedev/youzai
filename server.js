const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Keys (simpan di server - AMAN)
const CONFIG = {
    openaiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE',
    geminiKey: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE'
};

// System prompt untuk identitas Youz AI
const SYSTEM_PROMPT = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. 
Kamu dibuat oleh Developer Yuzz Ofc. 
Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik.
Kamu bisa membantu berbagai hal: coding, menulis, analisis, diskusi, dan lain-lain.
Jawablah pertanyaan pengguna dengan tepat dan akurat.`;

// ========== OPENAI ENDPOINT ==========
app.post('/api/openai/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        // Tambahkan system prompt di awal
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.openaiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: fullMessages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'OpenAI API Error');
        }

        res.json({ 
            success: true, 
            content: data.choices[0].message.content,
            model: 'openai'
        });
    } catch (error) {
        console.error('OpenAI Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== GEMINI ENDPOINT ==========
app.post('/api/gemini/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
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

        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.geminiKey}`;

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

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API Error');
        }

        res.json({ 
            success: true, 
            content: data.candidates[0].content.parts[0].text,
            model: 'gemini'
        });
    } catch (error) {
        console.error('Gemini Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== GEMINI VISION (Analisis Gambar) ==========
app.post('/api/gemini/vision', async (req, res) => {
    try {
        const { imageData, prompt } = req.body;
        
        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.geminiKey}`;
        
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

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini Vision Error');
        }

        res.json({ 
            success: true, 
            content: data.candidates[0].content.parts[0].text 
        });
    } catch (error) {
        console.error('Gemini Vision Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Youz AI Server running on http://localhost:${PORT}`);
    console.log(`📌 OpenAI: ${CONFIG.openaiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`📌 Gemini: ${CONFIG.geminiKey ? '✅ Configured' : '❌ Missing'}`);
});
