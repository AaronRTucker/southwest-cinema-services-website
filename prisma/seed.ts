import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const LOCATIONS = [
  // San Antonio
  {
    name: "Alamo Drafthouse Park North",
    address: "618 NW Loop 410, Ste 307",
    city: "San Antonio", state: "TX", zip: "78216",
    screens: 8, barco: true,
  },
  {
    name: "Alamo Drafthouse Stone Oak",
    address: "22806 US Hwy 281 N",
    city: "San Antonio", state: "TX", zip: "78258",
    screens: 6, barco: true,
  },
  // Austin
  {
    name: "Alamo Drafthouse Slaughter Lane",
    address: "5701 W Slaughter Ln, Bldg F",
    city: "Austin", state: "TX", zip: "78749",
    screens: 8, barco: false,
  },
  {
    name: "Alamo Drafthouse South Lamar",
    address: "1120 S Lamar Blvd",
    city: "Austin", state: "TX", zip: "78704",
    screens: 9, barco: true,
  },
  {
    name: "Alamo Drafthouse Mueller",
    address: "1911 Aldrich St, Ste 120",
    city: "Austin", state: "TX", zip: "78723",
    screens: 6, barco: true,
  },
  {
    name: "Alamo Drafthouse Lakeline",
    address: "14028 N US Hwy 183, Bldg F",
    city: "Austin", state: "TX", zip: "78717",
    screens: 10, barco: true,
  },
  {
    name: "Alamo Drafthouse Village",
    address: "2700 W Anderson Ln, #701",
    city: "Austin", state: "TX", zip: "78757",
    screens: 4, barco: true,
  },
  // DFW
  {
    name: "Alamo Drafthouse Cedars",
    address: "1005 Botham Jean Blvd",
    city: "Dallas", state: "TX", zip: "75215",
    screens: 7, barco: false,
  },
  {
    name: "Alamo Drafthouse Lake Highlands",
    address: "6770 Abrams Rd",
    city: "Dallas", state: "TX", zip: "75231",
    screens: 8, barco: false,
  },
  {
    name: "Alamo Drafthouse Richardson",
    address: "100 S Central Expy, Ste 14",
    city: "Richardson", state: "TX", zip: "75080",
    screens: 7, barco: true,
  },
  {
    name: "Alamo Drafthouse Denton",
    address: "3220 Town Center Tr",
    city: "Denton", state: "TX", zip: "76201",
    screens: 8, barco: false,
  },
  {
    name: "Alamo Drafthouse Las Colinas",
    address: "320 W Las Colinas Blvd, Bldg A2",
    city: "Irving", state: "TX", zip: "75039",
    screens: 7, barco: true,
  },
];

async function main() {
  console.log("Seeding database...");

  // Admin account
  const adminPassword = await bcrypt.hash("admin", 10);
  await prisma.user.upsert({
    where: { email: "admin@southwestcinema.com" },
    update: {},
    create: {
      email: "admin@southwestcinema.com",
      password: adminPassword,
      name: "Aaron Tucker",
      role: Role.ADMIN,
    },
  });

  // Alamo Drafthouse portal account
  const alamoPassword = await bcrypt.hash("alamo", 10);
  const alamoUser = await prisma.user.upsert({
    where: { email: "portal@alamodrafthouse.com" },
    update: {},
    create: {
      email: "portal@alamodrafthouse.com",
      password: alamoPassword,
      name: "Alamo Drafthouse",
      role: Role.CUSTOMER,
    },
  });

  for (const loc of LOCATIONS) {
    // Skip if location already exists
    const existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (existing) {
      console.log(`  Skipping ${loc.name} (already exists)`);
      continue;
    }

    const location = await prisma.location.create({
      data: {
        name: loc.name,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        zip: loc.zip,
        customer: "Alamo Drafthouse",
        users: { connect: { id: alamoUser.id } },
      },
    });

    console.log(`  Created ${loc.name}`);

    if (!loc.screens) {
      console.log(`    ⚠ Screen count unknown — auditoriums not seeded`);
      continue;
    }

    for (let i = 1; i <= loc.screens; i++) {
      const auditorium = await prisma.auditorium.create({
        data: {
          number: i,
          locationId: location.id,
          is4K: true,
          isLaser: loc.barco,
        },
      });

      await prisma.equipment.create({
        data: {
          name: `Auditorium ${i} Projector`,
          type: "PROJECTOR",
          manufacturer: loc.barco ? "Barco" : "Sony",
          model: loc.barco ? "SP4K-25B" : "SRX-R515",
          locationId: location.id,
          auditoriumId: auditorium.id,
        },
      });
    }

    console.log(`    Created ${loc.screens} auditoriums with projectors`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
