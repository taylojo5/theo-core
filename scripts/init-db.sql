-- ═══════════════════════════════════════════════════════════════════════════
-- Theo Database Initialization Script
-- Runs automatically on first PostgreSQL container start
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Verify extensions are installed
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions initialized:';
    RAISE NOTICE '  - uuid-ossp: UUID generation';
    RAISE NOTICE '  - pgcrypto: Cryptographic functions';
    RAISE NOTICE '  - vector: Vector similarity search (pgvector)';
END $$;

