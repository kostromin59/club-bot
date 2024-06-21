/*
  Warnings:

  - Added the required column `answerEndDate` to the `Homework` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Homework" ADD COLUMN     "answerEndDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "HomeworkAnswer" ADD COLUMN     "link" TEXT,
ALTER COLUMN "filePath" DROP NOT NULL;
