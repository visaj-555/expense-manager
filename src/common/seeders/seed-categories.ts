import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

type SeedCategoryType = 'INCOME' | 'EXPENSE';

const CATEGORY_SEED: Array<{
  name: string;
  type: SeedCategoryType;
  icon: string;
  color: string;
}> = [
  { name: 'Salary', type: 'INCOME', icon: '💰', color: '#059669' },
  { name: 'Food', type: 'EXPENSE', icon: '🍔', color: '#F97316' },
  { name: 'Groceries', type: 'EXPENSE', icon: '🛒', color: '#84CC16' },
  { name: 'Office Travel', type: 'EXPENSE', icon: '💼', color: '#6366F1' },
  { name: 'God', type: 'EXPENSE', icon: '🙏', color: '#F59E0B' },
  { name: 'PG', type: 'EXPENSE', icon: '🏠', color: '#0EA5E9' },
  { name: 'Personal', type: 'EXPENSE', icon: '👤', color: '#8B5CF6' },
  { name: 'Dahod', type: 'EXPENSE', icon: '📍', color: '#EC4899' },
  { name: 'Iron', type: 'EXPENSE', icon: '🧺', color: '#64748B' },
  { name: 'Recharge', type: 'EXPENSE', icon: '📱', color: '#06B6D4' },
  { name: 'Home', type: 'EXPENSE', icon: '🏡', color: '#14B8A6' },
  { name: 'Social', type: 'EXPENSE', icon: '🎉', color: '#E11D48' },
  { name: 'Petrol', type: 'EXPENSE', icon: '⛽', color: '#EF4444' },
  { name: 'Healthy Food', type: 'EXPENSE', icon: '🥗', color: '#22C55E' },
  { name: 'Local Travel', type: 'EXPENSE', icon: '🚌', color: '#3B82F6' },
  { name: 'Savings', type: 'EXPENSE', icon: '🏦', color: '#0D9488' },
  { name: 'SIP', type: 'EXPENSE', icon: '📈', color: '#2563EB' },
  { name: 'Grooming', type: 'EXPENSE', icon: '✂️', color: '#A855F7' },
  { name: 'Gadgets', type: 'EXPENSE', icon: '🎧', color: '#7C3AED' },
  { name: 'Clothing', type: 'EXPENSE', icon: '👕', color: '#DB2777' },
  { name: 'Shoes', type: 'EXPENSE', icon: '👟', color: '#9333EA' },
  { name: 'Entertainment', type: 'EXPENSE', icon: '🎬', color: '#F43F5E' },
  { name: 'Trip', type: 'EXPENSE', icon: '✈️', color: '#0284C7' },
  { name: 'Medical', type: 'EXPENSE', icon: '🏥', color: '#DC2626' },
  { name: 'Showroom', type: 'EXPENSE', icon: '🏪', color: '#CA8A04' },
];

async function seedCategoriesForUser(userId: string, userName: string) {
  let created = 0;
  let skipped = 0;

  for (const category of CATEGORY_SEED) {
    const existing = await prisma.category.findFirst({
      where: {
        userId,
        name: { equals: category.name, mode: 'insensitive' },
        type: category.type,
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.category.create({
      data: {
        userId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
      },
    });
    created += 1;
  }

  console.log(
    `  ✓ ${userName} (${userName}): created ${created}, skipped ${skipped}`,
  );
}

async function main() {
  const emailFilter = process.argv[2]; // optional: npm run seed:categories -- user@example.com

  const users = await prisma.user.findMany({
    where: emailFilter
      ? { auth: { email: { equals: emailFilter, mode: 'insensitive' } } }
      : undefined,
    select: {
      id: true,
      name: true,
      auth: { select: { email: true } },
    },
  });

  if (users.length === 0) {
    console.log(
      emailFilter
        ? `No user found with email: ${emailFilter}`
        : 'No users found. Register a user first, then re-run the seeder.',
    );
    return;
  }

  console.log(`Seeding ${CATEGORY_SEED.length} categories for ${users.length} user(s)...`);
  console.log('  - Salary → INCOME');
  console.log('  - All others → EXPENSE\n');

  for (const user of users) {
    await seedCategoriesForUser(user.id, `${user.name} <${user.auth.email}>`);
  }

  console.log('\nCategory seeding completed.');
}

main()
  .catch((error) => {
    console.error('Category seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
