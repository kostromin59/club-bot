-- CreateTable
CREATE TABLE "HomeWork" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeWorkAnswer" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT NOT NULL,
    "homeWorkId" INTEGER NOT NULL,
    "userId" BIGINT NOT NULL,

    CONSTRAINT "HomeWorkAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HomeWorkAnswer" ADD CONSTRAINT "HomeWorkAnswer_homeWorkId_fkey" FOREIGN KEY ("homeWorkId") REFERENCES "HomeWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeWorkAnswer" ADD CONSTRAINT "HomeWorkAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
