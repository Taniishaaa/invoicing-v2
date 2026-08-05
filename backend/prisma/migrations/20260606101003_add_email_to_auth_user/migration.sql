/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `AuthUser` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `AuthUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "email" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");
