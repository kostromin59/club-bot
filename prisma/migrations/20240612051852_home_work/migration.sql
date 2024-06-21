-- CreateTable
CREATE TABLE "Homework" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAnswer" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT NOT NULL,
    "homeworkId" INTEGER NOT NULL,
    "userId" BIGINT NOT NULL,

    CONSTRAINT "HomeworkAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
