// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== DATABASE FILE ==========
const DB_FILE = path.join(__dirname, 'database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ conversations: [] }, null, 2));
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { conversations: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// ========== API KEYS ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('========================================');
console.log('🚀 Youz AI Server Starting...');
console.log('========================================');
console.log(`📌 OpenAI API Key : ${OPENAI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log(`📌 Gemini API Key : ${GEMINI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log('========================================\n');

// System prompt
const SYSTEM_PROMPT = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik dan benar.`;

// ========== DATABASE API ==========
app.get('/api/conversations', (req, res) => {
    try {
        const db = readDB();
        const conversations = db.conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv.messages.length
        }));
        res.json({ success: true, data: conversations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/conversations/:id', (req, res) => {
    try {
        const db = readDB();
        const conversation = db.conversations.find(c => c.id === req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        res.json({ success: true, data: conversation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/conversations', (req, res) => {
    try {
        const db = readDB();
        const { title } = req.body;
        const newConversation = {
            id: uuidv4(),
            title: title || 'Percakapan Baru',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        db.conversations.push(newConversation);
        writeDB(db);
        res.json({ success: true, data: newConversation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
    try {
        const db = readDB();
        const conversation = db.conversations.find(c => c.id === req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        
        const { role, content, model, image } = req.body;
        const message = {
            id: uuidv4(),
            role,
            content,
            model,
            image: image || null,
            timestamp: new Date().toISOString()
        };
        
        conversation.messages.push(message);
        conversation.updatedAt = new Date().toISOString();
        
        if (conversation.messages.filter(m => m.role === 'user').length === 1 && role === 'user') {
            conversation.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        }
        
        writeDB(db);
        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/conversations/:id', (req, res) => {
    try {
        const db = readDB();
        const index = db.conversations.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        db.conversations.splice(index, 1);
        writeDB(db);
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/conversations', (req, res) => {
    try {
        const db = { conversations: [] };
        writeDB(db);
        res.json({ success: true, message: 'All conversations deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== AI ENDPOINTS ==========

// OpenAI Chat - DENGAN FALLBACK
app.post('/api/openai/chat', async (req, res) => {
    try {
        if (!OPENAI_API_KEY) {
            return res.json({ 
                success: false, 
                error: 'OpenAI API Key tidak dikonfigurasi. Tambahkan di file .env' 
            });
        }

        const { messages } = req.body;
        
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        console.log('📤 [OpenAI] Mengirim request...');

        // Gunakan fetch dengan timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: fullMessages,
                    max_tokens: 1000,
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            // Baca response sebagai text dulu untuk debugging
            const textResponse = await response.text();
            
            console.log(`📡 [OpenAI] Status: ${response.status}`);
            console.log(`📡 [OpenAI] Response preview: ${textResponse.substring(0, 200)}`);

            if (!response.ok) {
                // Coba parse error
                try {
                    const errorJson = JSON.parse(textResponse);
                    throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
                } catch (e) {
                    throw new Error(`OpenAI API Error (${response.status}): ${textResponse.substring(0, 100)}`);
                }
            }

            // Parse JSON response
            const data = JSON.parse(textResponse);
            
            console.log('✅ [OpenAI] Response berhasil');

            res.json({ 
                success: true, 
                content: data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.',
                model: 'openai'
            });

        } catch (fetchError) {
            clearTimeout(timeout);
            
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout (30 detik)');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('❌ [OpenAI] Error:', error.message);
        
        // Kembalikan response error yang valid (bukan throw)
        res.json({ 
            success: false, 
            error: error.message,
            content: `Maaf, terjadi kesalahan: ${error.message}. Silakan coba lagi.`
        });
    }
});

// Gemini Chat - DENGAN FALLBACK
app.post('/api/gemini/chat', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.json({ 
                success: false, 
                error: 'Gemini API Key tidak dikonfigurasi. Tambahkan di file .env' 
            });
        }

        const { messages } = req.body;
        
        // Buat prompt dari messages
        let prompt = `${SYSTEM_PROMPT}\n\n`;
        for (const msg of messages) {
            if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Youz AI: ${msg.content}\n`;
            }
        }
        prompt += 'Youz AI: ';

        console.log('📤 [Gemini] Mengirim request...');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            const textResponse = await response.text();
            
            console.log(`📡 [Gemini] Status: ${response.status}`);
            console.log(`📡 [Gemini] Response preview: ${textResponse.substring(0, 200)}`);

            if (!response.ok) {
                try {
                    const errorJson = JSON.parse(textResponse);
                    throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
                } catch (e) {
                    throw new Error(`Gemini API Error (${response.status}): ${textResponse.substring(0, 100)}`);
                }
            }

            const data = JSON.parse(textResponse);
            
            console.log('✅ [Gemini] Response berhasil');

            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, tidak ada respons.';

            res.json({ 
                success: true, 
                content: content,
                model: 'gemini'
            });

        } catch (fetchError) {
            clearTimeout(timeout);
            
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout (30 detik)');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('❌ [Gemini] Error:', error.message);
        
        res.json({ 
            success: false, 
            error: error.message,
            content: `Maaf, terjadi kesalahan: ${error.message}. Silakan coba lagi.`
        });
    }
});

// Gemini Vision
app.post('/api/gemini/vision', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.json({ 
                success: false, 
                error: 'Gemini API Key tidak dikonfigurasi.' 
            });
        }

        const { imageData, prompt } = req.body;
        
        if (!imageData) {
            return res.json({ success: false, error: 'Tidak ada gambar' });
        }

        console.log('📤 [Gemini Vision] Menganalisis gambar...');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt || 'Deskripsikan gambar ini dalam Bahasa Indonesia.' },
                            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                        ]
                    }]
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            const textResponse = await response.text();
            
            console.log(`📡 [Gemini Vision] Status: ${response.status}`);

            if (!response.ok) {
                try {
                    const errorJson = JSON.parse(textResponse);
                    throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
                } catch (e) {
                    throw new Error(`Gemini Vision Error (${response.status})`);
                }
            }

            const data = JSON.parse(textResponse);
            
            console.log('✅ [Gemini Vision] Analisis selesai');

            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak dapat menganalisis gambar.';

            res.json({ 
                success: true, 
                content: content 
            });

        } catch (fetchError) {
            clearTimeout(timeout);
            throw fetchError;
        }

    } catch (error) {
        console.error('❌ [Gemini Vision] Error:', error.message);
        
        res.json({ 
            success: false, 
            error: error.message,
            content: `Gagal menganalisis gambar: ${error.message}`
        });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    const db = readDB();
    res.json({
        status: 'ok',
        openai: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY,
        conversations: db.conversations.length,
        timestamp: new Date().toISOString()
    });
});

// Test endpoint untuk cek API Key
app.get('/api/test-keys', async (req, res) => {
    const results = {
        openai: { status: 'unknown', message: '' },
        gemini: { status: 'unknown', message: '' }
    };
    
    // Test OpenAI
    if (OPENAI_API_KEY) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
            });
            results.openai = {
                status: response.ok ? 'ok' : 'error',
                message: response.ok ? 'API Key valid' : `HTTP ${response.status}`
            };
        } catch (e) {
            results.openai = { status: 'error', message: e.message };
        }
    } else {
        results.openai = { status: 'missing', message: 'API Key tidak ada' };
    }
    
    // Test Gemini
    if (GEMINI_API_KEY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
            const response = await fetch(url);
            results.gemini = {
                status: response.ok ? 'ok' : 'error',
                message: response.ok ? 'API Key valid' : `HTTP ${response.status}`
            };
        } catch (e) {
            results.gemini = { status: 'error', message: e.message };
        }
    } else {
        results.gemini = { status: 'missing', message: 'API Key tidak ada' };
    }
    
    res.json(results);
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`✨ Youz AI Server berjalan di http://localhost:${PORT}`);
    console.log(`🔍 Test API Keys: http://localhost:${PORT}/api/test-keys`);
    console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});
