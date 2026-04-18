-- AlterTable
ALTER TABLE "Location" ADD COLUMN "city" TEXT;
ALTER TABLE "Location" ADD COLUMN "customer" TEXT;
ALTER TABLE "Location" ADD COLUMN "state" TEXT;
ALTER TABLE "Location" ADD COLUMN "zip" TEXT;

-- CreateTable
CREATE TABLE "Auditorium" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "locationId" TEXT NOT NULL,
    "screenWidth" REAL,
    "screenHeight" REAL,
    "screenAspect" TEXT,
    "seatingCapacity" INTEGER,
    "hasAtmos" BOOLEAN NOT NULL DEFAULT false,
    "hasDtsx" BOOLEAN NOT NULL DEFAULT false,
    "is4K" BOOLEAN NOT NULL DEFAULT true,
    "isLaser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Auditorium_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditoriumAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditoriumId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditoriumAttribute_auditoriumId_fkey" FOREIGN KEY ("auditoriumId") REFERENCES "Auditorium" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentAttribute_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PMChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pmReportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "PMChecklistItem_pmReportId_fkey" FOREIGN KEY ("pmReportId") REFERENCES "PMReport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "firmwareVersion" TEXT,
    "installDate" DATETIME,
    "warrantyExpiry" DATETIME,
    "relayId" TEXT,
    "locationId" TEXT NOT NULL,
    "auditoriumId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_auditoriumId_fkey" FOREIGN KEY ("auditoriumId") REFERENCES "Auditorium" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("createdAt", "id", "locationId", "manufacturer", "model", "name", "serialNumber", "type", "updatedAt") SELECT "createdAt", "id", "locationId", "manufacturer", "model", "name", "serialNumber", "type", "updatedAt" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
CREATE TABLE "new_PMReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "technician" TEXT,
    "locationId" TEXT NOT NULL,
    "auditoriumId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PMReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PMReport_auditoriumId_fkey" FOREIGN KEY ("auditoriumId") REFERENCES "Auditorium" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PMReport" ("createdAt", "date", "details", "id", "locationId", "summary") SELECT "createdAt", "date", "details", "id", "locationId", "summary" FROM "PMReport";
DROP TABLE "PMReport";
ALTER TABLE "new_PMReport" RENAME TO "PMReport";
CREATE TABLE "new_ServiceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "technician" TEXT,
    "notes" TEXT,
    "parts" TEXT,
    "equipmentId" TEXT,
    "locationId" TEXT,
    "auditoriumId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRecord_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRecord_auditoriumId_fkey" FOREIGN KEY ("auditoriumId") REFERENCES "Auditorium" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceRecord" ("createdAt", "date", "description", "equipmentId", "id", "notes", "technician") SELECT "createdAt", "date", "description", "equipmentId", "id", "notes", "technician" FROM "ServiceRecord";
DROP TABLE "ServiceRecord";
ALTER TABLE "new_ServiceRecord" RENAME TO "ServiceRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
