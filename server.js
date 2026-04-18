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

// Inisialisasi database jika belum ada
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ conversations: [] }, null, 2));
}

// Helper functions database
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

// ========== API KEYS DARI .ENV ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('========================================');
console.log('🚀 Youz AI Server Starting...');
console.log('========================================');
console.log(`📌 OpenAI API Key : ${OPENAI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log(`📌 Gemini API Key : ${GEMINI_API_KEY ? '✅ Tersedia' : '❌ Tidak ada'}`);
console.log(`💾 Database       : ${DB_FILE}`);
console.log(`🌐 Port           : ${PORT}`);
console.log('========================================\n');

// System prompt
const SYSTEM_PROMPT = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik dan benar.`;

// ========== HELPER: SAFE FETCH ==========
async function safeFetch(url, options) {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type') || '';
        const textResponse = await response.text();
        
        if (!response.ok) {
            try {
                const errorJson = JSON.parse(textResponse);
                throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
            } catch (e) {
                if (textResponse.includes('<html>')) {
                    throw new Error(`API Error (${response.status}): Invalid response`);
                }
                throw new Error(`API Error (${response.status}): ${textResponse.substring(0, 100)}`);
            }
        }
        
        try {
            return JSON.parse(textResponse);
        } catch (e) {
            throw new Error('Invalid JSON response from API');
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error.message);
        throw error;
    }
}

// ========== DATABASE API ENDPOINTS ==========

// Get all conversations
app.get('/api/conversations', (req, res) => {
    try {
        const db = readDB();
        // Return conversations tanpa messages untuk list (hemat bandwidth)
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

// Get single conversation with messages
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

// Create new conversation
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

// Add message to conversation
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
        
        // Update title jika pesan pertama dari user
        if (conversation.messages.filter(m => m.role === 'user').length === 1 && role === 'user') {
            conversation.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        }
        
        writeDB(db);
        
        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete conversation
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

// Delete all conversations
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

// OpenAI Chat
app.post('/api/openai/chat', async (req, res) => {
    try {
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ success: false, error: 'OpenAI API Key tidak dikonfigurasi' });
        }

        const { messages } = req.body;
        
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        console.log(`📤 [OpenAI] Sending request...`);

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

        console.log(`✅ [OpenAI] Response received`);

        res.json({ 
            success: true, 
            content: data.choices?.[0]?.message?.content || '(No response)',
            model: 'openai'
        });

    } catch (error) {
        console.error('❌ [OpenAI] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gemini Chat
app.post('/api/gemini/chat', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: 'Gemini API Key tidak dikonfigurasi' });
        }

        const { messages } = req.body;
        
        let prompt = `${SYSTEM_PROMPT}\n\n`;
        for (const msg of messages) {
            if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Youz AI: ${msg.content}\n`;
            }
        }
        prompt += 'Youz AI: ';

        console.log(`📤 [Gemini] Sending request...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const data = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
            })
        });

        console.log(`✅ [Gemini] Response received`);

        res.json({ 
            success: true, 
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '(No response)',
            model: 'gemini'
        });

    } catch (error) {
        console.error('❌ [Gemini] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gemini Vision
app.post('/api/gemini/vision', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: 'Gemini API Key tidak dikonfigurasi' });
        }

        const { imageData, prompt } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ success: false, error: 'No image data' });
        }

        console.log(`📤 [Gemini Vision] Analyzing image...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        
        const data = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt || 'Deskripsikan gambar ini dalam Bahasa Indonesia.' },
                        { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                    ]
                }]
            })
        });

        console.log(`✅ [Gemini Vision] Analysis complete`);

        res.json({ 
            success: true, 
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '(Cannot analyze image)'
        });

    } catch (error) {
        console.error('❌ [Gemini Vision] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
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

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`✨ Youz AI Server running at http://localhost:${PORT}`);
    console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});
