-- Fix migration script for phone_document_mapping and core RAG tables
-- Run this in your Supabase SQL editor to resolve 500 errors

-- 1. Enable pgvector for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Ensure Core RAG Tables exist
CREATE TABLE IF NOT EXISTS rag_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES rag_files(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1024), -- Mistral embeddings size
    source TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure phone_document_mapping exists
CREATE TABLE IF NOT EXISTS phone_document_mapping (
    phone_number TEXT NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add missing columns to phone_document_mapping table
ALTER TABLE phone_document_mapping 
ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES rag_files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS intent TEXT,
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS auth_token TEXT,
ADD COLUMN IF NOT EXISTS origin TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
ADD COLUMN IF NOT EXISTS groq_api_key TEXT,
ADD COLUMN IF NOT EXISTS mistral_api_key TEXT;

-- 5. Create a view for easier querying (used by some API routes)
CREATE OR REPLACE VIEW phone_document_view AS
SELECT 
    m.phone_number,
    m.file_id,
    m.intent,
    m.system_prompt,
    m.auth_token,
    m.origin,
    m.created_at,
    f.name as file_name,
    f.file_type
FROM phone_document_mapping m
LEFT JOIN rag_files f ON m.file_id = f.id;

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_phone_doc_mapping_phone ON phone_document_mapping(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_doc_mapping_file ON phone_document_mapping(file_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_file_id ON rag_chunks(file_id);

-- 7. Enable RLS and add policy
ALTER TABLE rag_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_document_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rag_files" ON rag_files;
CREATE POLICY "Allow all operations on rag_files" ON rag_files FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on rag_chunks" ON rag_chunks;
CREATE POLICY "Allow all operations on rag_chunks" ON rag_chunks FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on phone_document_mapping" ON phone_document_mapping;
CREATE POLICY "Allow all operations on phone_document_mapping" ON phone_document_mapping FOR ALL USING (true);

-- 9. Create user_conversation_data for tracking conversation stages
CREATE TABLE IF NOT EXISTS public.user_conversation_data (
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    current_stage TEXT DEFAULT 'DISCOVERY',
    collected_info JSONB DEFAULT '{}',
    first_message_sent BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (from_number, to_number)
);

-- Enable RLS for the new table
ALTER TABLE public.user_conversation_data ENABLE ROW LEVEL SECURITY;

-- Simple policy (Consider hardening for production)
DROP POLICY IF EXISTS "Allow all access" ON public.user_conversation_data;
CREATE POLICY "Allow all access" ON public.user_conversation_data FOR ALL USING (true);
