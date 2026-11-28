BEGIN;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "repositoryUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "development_session" ADD COLUMN     "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "solutions" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'final',
ADD COLUMN     "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "session_attachment" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "sessionId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "completedDate" DATE,
    "criteria" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "investigation" TEXT,
    "solution" TEXT,
    "lessons" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedDate" DATE,
    "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_goal" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT,
    "technology" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "evidence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "understanding" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "targetDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "from" DATE,
    "to" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflection" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repository" (
    "projectId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "description" TEXT,
    "isPrivate" BOOLEAN,
    "lastSyncAt" TIMESTAMPTZ(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncMessage" TEXT,
    "syncStartedAt" TIMESTAMPTZ(3),

    CONSTRAINT "github_repository_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "github_activity" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "projectId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "details" TEXT,

    CONSTRAINT "github_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_session_link" (
    "sessionId" BIGINT NOT NULL,
    "activityId" BIGINT NOT NULL,

    CONSTRAINT "github_session_link_pkey" PRIMARY KEY ("sessionId","activityId")
);

-- CreateTable
CREATE TABLE "_MilestoneSessions" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_MilestoneSessions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LearningGoalSessions" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_LearningGoalSessions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InsightSessions" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_InsightSessions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReflectionSessions" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ReflectionSessions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ChallengeSessions" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ChallengeSessions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "session_attachment_sessionId_id_idx" ON "session_attachment"("sessionId", "id");

-- CreateIndex
CREATE INDEX "milestone_projectId_targetDate_idx" ON "milestone"("projectId", "targetDate");

-- CreateIndex
CREATE INDEX "challenge_resolvedDate_idx" ON "challenge"("resolvedDate");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_projectId_title_key" ON "challenge"("projectId", "title");

-- CreateIndex
CREATE INDEX "learning_goal_projectId_idx" ON "learning_goal"("projectId");

-- CreateIndex
CREATE INDEX "report_projectId_idx" ON "report"("projectId");

-- CreateIndex
CREATE INDEX "insight_projectId_idx" ON "insight"("projectId");

-- CreateIndex
CREATE INDEX "reflection_projectId_idx" ON "reflection"("projectId");

-- CreateIndex
CREATE INDEX "github_activity_project_order_idx" ON "github_activity"("projectId", "occurredAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "github_activity_occurredAt_idx" ON "github_activity"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "github_activity_projectId_kind_externalId_key" ON "github_activity"("projectId", "kind", "externalId");

-- CreateIndex
CREATE INDEX "github_session_link_activityId_idx" ON "github_session_link"("activityId");

-- CreateIndex
CREATE INDEX "_MilestoneSessions_B_index" ON "_MilestoneSessions"("B");

-- CreateIndex
CREATE INDEX "_LearningGoalSessions_B_index" ON "_LearningGoalSessions"("B");

-- CreateIndex
CREATE INDEX "_InsightSessions_B_index" ON "_InsightSessions"("B");

-- CreateIndex
CREATE INDEX "_ReflectionSessions_B_index" ON "_ReflectionSessions"("B");

-- CreateIndex
CREATE INDEX "_ChallengeSessions_B_index" ON "_ChallengeSessions"("B");

-- AddForeignKey
ALTER TABLE "session_attachment" ADD CONSTRAINT "session_attachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "learning_goal" ADD CONSTRAINT "learning_goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "insight" ADD CONSTRAINT "insight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reflection" ADD CONSTRAINT "reflection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "github_repository" ADD CONSTRAINT "github_repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "github_activity" ADD CONSTRAINT "github_activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "github_repository"("projectId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "github_session_link" ADD CONSTRAINT "github_session_link_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "github_session_link" ADD CONSTRAINT "github_session_link_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "github_activity"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "_MilestoneSessions" ADD CONSTRAINT "_MilestoneSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MilestoneSessions" ADD CONSTRAINT "_MilestoneSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LearningGoalSessions" ADD CONSTRAINT "_LearningGoalSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LearningGoalSessions" ADD CONSTRAINT "_LearningGoalSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "learning_goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsightSessions" ADD CONSTRAINT "_InsightSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsightSessions" ADD CONSTRAINT "_InsightSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReflectionSessions" ADD CONSTRAINT "_ReflectionSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReflectionSessions" ADD CONSTRAINT "_ReflectionSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "reflection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeSessions" ADD CONSTRAINT "_ChallengeSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeSessions" ADD CONSTRAINT "_ChallengeSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "development_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project"
    ADD CONSTRAINT "project_status_check" CHECK ("status" IN ('planned', 'active', 'on_hold', 'completed', 'archived')),
    ADD CONSTRAINT "project_repository_length_check" CHECK (char_length("repositoryUrl") <= 2048),
    ADD CONSTRAINT "project_technologies_check" CHECK (cardinality("technologies") <= 24);

ALTER TABLE "development_session" DROP CONSTRAINT "development_session_summary_check";
ALTER TABLE "development_session"
    ADD CONSTRAINT "development_session_summary_check" CHECK (
        ("status" = 'draft' OR devtrail_nonblank("workSummary")) AND char_length("workSummary") <= 5000
    ),
    ADD CONSTRAINT "development_session_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "development_session_duration_check" CHECK ("durationMinutes" BETWEEN 1 AND 1440),
    ADD CONSTRAINT "development_session_status_check" CHECK ("status" IN ('draft', 'final')),
    ADD CONSTRAINT "development_session_solutions_check" CHECK (char_length("solutions") <= 5000),
    ADD CONSTRAINT "development_session_lists_check" CHECK (
        cardinality("technologies") <= 24 AND cardinality("tags") <= 24 AND
        cardinality("references") <= 24 AND cardinality("categories") <= 9
    );

ALTER TABLE "session_attachment"
    ADD CONSTRAINT "session_attachment_size_check" CHECK ("size" BETWEEN 1 AND 163840 AND "size" = octet_length("content")),
    ADD CONSTRAINT "session_attachment_name_check" CHECK (devtrail_nonblank("name") AND char_length("name") <= 120),
    ADD CONSTRAINT "session_attachment_media_check" CHECK ("mediaType" IN (
        'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf', 'image/png', 'image/jpeg'
    ));

ALTER TABLE "milestone"
    ADD CONSTRAINT "milestone_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "milestone_status_check" CHECK ("status" IN ('planned', 'active', 'completed')),
    ADD CONSTRAINT "milestone_completion_check" CHECK (("status" = 'completed') = ("completedDate" IS NOT NULL));

ALTER TABLE "challenge"
    ADD CONSTRAINT "challenge_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "challenge_description_check" CHECK (devtrail_nonblank("description") AND char_length("description") <= 5000),
    ADD CONSTRAINT "challenge_status_check" CHECK ("status" IN ('open', 'in_progress', 'resolved')),
    ADD CONSTRAINT "challenge_resolution_check" CHECK (("status" = 'resolved') = ("resolvedDate" IS NOT NULL));
CREATE UNIQUE INDEX "challenge_project_title_ci_key" ON "challenge" (
    "projectId", (normalize("title", NFC)) COLLATE project_name_ci
);

ALTER TABLE "learning_goal"
    ADD CONSTRAINT "learning_goal_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "learning_goal_technology_check" CHECK (devtrail_nonblank("technology") AND char_length("technology") <= 80),
    ADD CONSTRAINT "learning_goal_status_check" CHECK ("status" IN ('planned', 'active', 'completed')),
    ADD CONSTRAINT "learning_goal_understanding_check" CHECK ("understanding" IN ('exploring', 'practicing', 'comfortable'));

ALTER TABLE "report"
    ADD CONSTRAINT "report_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "report_kind_check" CHECK ("kind" IN ('daily', 'weekly', 'monthly', 'project', 'learning', 'challenges', 'retrospective')),
    ADD CONSTRAINT "report_range_check" CHECK ("from" <= "to"),
    ADD CONSTRAINT "report_content_check" CHECK (devtrail_nonblank("content") AND char_length("content") <= 30000);

ALTER TABLE "insight"
    ADD CONSTRAINT "insight_title_check" CHECK (devtrail_nonblank("title") AND char_length("title") <= 160),
    ADD CONSTRAINT "insight_kind_check" CHECK (devtrail_nonblank("kind") AND char_length("kind") <= 80),
    ADD CONSTRAINT "insight_content_check" CHECK (devtrail_nonblank("content") AND char_length("content") <= 30000);

ALTER TABLE "reflection"
    ADD CONSTRAINT "reflection_question_check" CHECK (devtrail_nonblank("question") AND char_length("question") <= 5000),
    ADD CONSTRAINT "reflection_answer_check" CHECK (devtrail_nonblank("answer") AND char_length("answer") <= 8000),
    ADD CONSTRAINT "reflection_feedback_check" CHECK (char_length("feedback") <= 8000);

ALTER TABLE "github_repository"
    ADD CONSTRAINT "github_repository_sync_status_check" CHECK ("syncStatus" IN ('idle', 'syncing', 'synced', 'partial', 'failed'));
CREATE UNIQUE INDEX "github_repository_identity_ci_key" ON "github_repository" (lower("owner"), lower("name"));

ALTER TABLE "github_activity"
    ADD CONSTRAINT "github_activity_kind_check" CHECK ("kind" IN ('commit', 'pull_request'));

COMMIT;

