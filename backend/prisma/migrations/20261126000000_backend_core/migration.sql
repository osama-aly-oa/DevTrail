BEGIN;

-- ICU level 2 compares case insensitively while retaining accent differences.
CREATE COLLATION project_name_ci (provider = icu, locale = 'und-u-ks-level2', deterministic = false);

-- Match JavaScript trim() for required text, independent of the database locale.
CREATE FUNCTION devtrail_nonblank(value TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE STRICT
RETURN length(btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0;

CREATE TABLE project (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_name_check CHECK (devtrail_nonblank(name) AND char_length(name) <= 120),
    CONSTRAINT project_description_check CHECK (char_length(description) <= 2000)
);

CREATE UNIQUE INDEX project_name_ci_key ON project ((normalize(name, NFC)) COLLATE project_name_ci);
CREATE INDEX project_order_idx ON project ("createdAt" DESC, id DESC);

CREATE TABLE development_session (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "projectId" BIGINT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "workSummary" TEXT NOT NULL,
    "workFocus" TEXT,
    "learningNotes" TEXT,
    difficulties TEXT,
    "nextSteps" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "development_session_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES project(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT development_session_date_check CHECK ("sessionDate" >= DATE '0001-01-01'),
    CONSTRAINT development_session_summary_check
        CHECK (devtrail_nonblank("workSummary") AND char_length("workSummary") <= 5000),
    CONSTRAINT development_session_focus_check CHECK (char_length("workFocus") <= 240),
    CONSTRAINT development_session_learning_check CHECK (char_length("learningNotes") <= 5000),
    CONSTRAINT development_session_difficulties_check CHECK (char_length(difficulties) <= 5000),
    CONSTRAINT development_session_next_steps_check CHECK (char_length("nextSteps") <= 5000)
);

CREATE FUNCTION devtrail_session_date_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."sessionDate" > (clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            CONSTRAINT = 'development_session_future_date_check',
            MESSAGE = 'Development session date cannot be in the future.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER development_session_future_date
    BEFORE INSERT OR UPDATE OF "sessionDate" ON development_session
    FOR EACH ROW EXECUTE FUNCTION devtrail_session_date_guard();

CREATE INDEX development_session_order_idx ON development_session ("sessionDate" DESC, "createdAt" DESC, id DESC);
CREATE INDEX development_session_project_order_idx ON development_session ("projectId", "sessionDate" DESC, "createdAt" DESC, id DESC);

CREATE TABLE owner_account (
    id SMALLINT PRIMARY KEY DEFAULT 1 CONSTRAINT owner_singleton_check CHECK (id = 1),
    username TEXT NOT NULL CONSTRAINT owner_username_check CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'),
    "passwordHash" TEXT NOT NULL CONSTRAINT owner_password_hash_check CHECK (left("passwordHash", 10) = '$argon2id$')
);

CREATE TABLE http_session (
    sid TEXT PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ(3) NOT NULL
);

CREATE INDEX http_session_expire_idx ON http_session (expire);

COMMIT;
