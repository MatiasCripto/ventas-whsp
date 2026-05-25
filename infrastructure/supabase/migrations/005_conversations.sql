-- Conversations schema

CREATE TYPE conversation_channel AS ENUM ('whatsapp', 'instagram', 'web');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'bot', 'human');

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) NOT NULL,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,

  channel           conversation_channel DEFAULT 'whatsapp',
  channel_contact_id TEXT NOT NULL,  -- wa number, ig id, etc
  channel_chat_id   TEXT NOT NULL,   -- wa chat id, ig thread, etc

  status            conversation_status DEFAULT 'open',
  context           JSONB DEFAULT '{}',
  human_takeover    BOOLEAN DEFAULT false,
  human_takeover_at TIMESTAMPTZ,
  human_takeover_reason TEXT,
  human_released_at TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(store_id, channel, channel_chat_id)
);

CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_store ON conversations(store_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_contact ON conversations(channel_contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC NULLS LAST);

-- ============================================================
-- Messages
-- ============================================================
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'video');

CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
  channel_message_id  TEXT UNIQUE,  -- ID from Evolution API

  direction           message_direction NOT NULL,
  type                message_type DEFAULT 'text',
  body                TEXT,
  media_url           TEXT,
  metadata            JSONB DEFAULT '{}',
  sent_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sent ON messages(conversation_id, sent_at);
