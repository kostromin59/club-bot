-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "fio" TEXT,
    "phone" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");
