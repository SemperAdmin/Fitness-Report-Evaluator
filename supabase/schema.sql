CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rank TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_updated TIMESTAMPTZ
);

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    evaluation_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
