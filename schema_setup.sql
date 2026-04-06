-- Enable pgvector for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Table 1: RAG Files (Central Knowledge Base)
CREATE TABLE IF NOT EXISTS rag_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: RAG Chunks (Embeddings for Vector Search)
CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES rag_files(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1024), -- Mistral embeddings size
    source TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Phone Document Mapping (Configuration per User/Number)
CREATE TABLE IF NOT EXISTS phone_document_mapping (
    phone_number TEXT NOT NULL,
    file_id UUID REFERENCES rag_files(id) ON DELETE SET NULL,
    intent TEXT,
    system_prompt TEXT,
    auth_token TEXT,
    origin TEXT,
    gemini_api_key TEXT,
    groq_api_key TEXT,
    mistral_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone_number)
);

-- Table 4: WhatsApp Messages (Conversation Logs)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT UNIQUE NOT NULL,
    channel TEXT DEFAULT 'whatsapp',
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    content_type TEXT DEFAULT 'text',
    content_text TEXT,
    sender_name TEXT,
    event_type TEXT,
    is_in_24_window BOOLEAN DEFAULT true,
    is_responded BOOLEAN DEFAULT false,
    auto_respond_sent BOOLEAN DEFAULT false,
    response_sent_at TIMESTAMPTZ,
    raw_payload JSONB,
    conversation_stage TEXT DEFAULT 'DISCOVERY', -- Tracker mentioned in prompt
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 5: User Conversation Data (State & Info Tracking for Persona Stages)
CREATE TABLE IF NOT EXISTS user_conversation_data (
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    current_stage TEXT DEFAULT 'DISCOVERY',
    collected_info JSONB DEFAULT '{}',
    first_message_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (from_number, to_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_chunks_file_id ON rag_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_phone_doc_mapping_phone ON phone_document_mapping(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from ON whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_to ON whatsapp_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_user_conv_data_from_to ON user_conversation_data(from_number, to_number);

-- RLS (Row Level Security) - Allow all for now as per local config but enable it
ALTER TABLE rag_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_document_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_conversation_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on rag_files" ON rag_files FOR ALL USING (true);
CREATE POLICY "Allow all operations on rag_chunks" ON rag_chunks FOR ALL USING (true);
CREATE POLICY "Allow all operations on phone_document_mapping" ON phone_document_mapping FOR ALL USING (true);
CREATE POLICY "Allow all operations on whatsapp_messages" ON whatsapp_messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_conversation_data" ON user_conversation_data FOR ALL USING (true);
