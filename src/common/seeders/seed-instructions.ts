import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

const EMAIL = 'uppanchal777@gmail.com';
const PASSWORD = 'Test@123';
const DISPLAY_NAME = 'Uppanchal';
const BANK_ACCOUNT_NAME = 'Bank';
const INSTRUCTIONS_PATH = resolve(__dirname, '../../../Instructions.txt');

const MONTHS: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Showroom: { icon: '🏪', color: '#CA8A04' },
  Travel: { icon: '🚌', color: '#3B82F6' },
  'Bank Hafto': { icon: '🏦', color: '#1D4ED8' },
  'Vegetable & Fruit': { icon: '🥬', color: '#22C55E' },
  Groceries: { icon: '🛒', color: '#84CC16' },
  God: { icon: '🙏', color: '#F59E0B' },
  Milk: { icon: '🥛', color: '#38BDF8' },
  Gas: { icon: '🔥', color: '#F97316' },
  'Social Expense': { icon: '🎉', color: '#E11D48' },
  'Light Bill': { icon: '💡', color: '#EAB308' },
  Maid: { icon: '🧹', color: '#64748B' },
  Visaj: { icon: '👤', color: '#8B5CF6' },
  'Snacks & Farsan': { icon: '🍪', color: '#F97316' },
  Medical: { icon: '🏥', color: '#DC2626' },
  Petrol: { icon: '⛽', color: '#EF4444' },
  Naavi: { icon: '✂️', color: '#A855F7' },
  Clothes: { icon: '👕', color: '#DB2777' },
  Savings: { icon: '💰', color: '#0D9488' },
  Gadgets: { icon: '🎧', color: '#7C3AED' },
  Recharge: { icon: '📱', color: '#06B6D4' },
  Repairing: { icon: '🔧', color: '#78716C' },
  Mediclame: { icon: '🧾', color: '#BE123C' },
  Extra: { icon: '➕', color: '#94A3B8' },
};

const DATE_LINE =
  /^((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}),(.*),₹([\d,.]+),(.*)$/;

type ParsedTx = {
  title: string;
  amount: number;
  categoryName: string;
  date: Date;
};

function parseInstructions(raw: string): { categories: string[]; rows: ParsedTx[] } {
  const categoryBlock = raw.split(/Category names\s*:/i)[1]?.split(/Tranactions\s*:/i)[0] ?? '';
  const categories = categoryBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const txBlock = raw.split(/Date,Name,Amount,Category/i)[1] ?? '';
  const rows: ParsedTx[] = [];

  for (const line of txBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(DATE_LINE);
    if (!match) continue;

    const [, dateRaw, nameRaw, amountRaw, categoryRaw] = match;
    const amount = parseFloat(amountRaw.replace(/,/g, ''));
    if (Number.isNaN(amount)) continue;

    const parts = dateRaw.match(/^(\w+) (\d{1,2}), (\d{4})$/);
    if (!parts) continue;
    const month = MONTHS[parts[1]];
    if (month == null) continue;

    const title = nameRaw.trim() || categoryRaw.trim();
    rows.push({
      title,
      amount,
      categoryName: categoryRaw.trim(),
      date: new Date(Date.UTC(Number(parts[3]), month, Number(parts[2]))),
    });
  }

  return { categories, rows };
}

async function ensureUser() {
  const existing = await prisma.auth.findUnique({
    where: { email: EMAIL },
    include: { user: { select: { id: true, name: true } } },
  });

  if (existing?.user) {
    if (!existing.isEmailVerified || !existing.isActive) {
      await prisma.auth.update({
        where: { id: existing.id },
        data: { isEmailVerified: true, isActive: true },
      });
    }
    console.log(`  ✓ User already exists: ${EMAIL}`);
    return existing.user;
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.$transaction(async (tx) => {
    const auth = await tx.auth.create({
      data: {
        email: EMAIL,
        password: hashedPassword,
        role: 'USER',
        isActive: true,
        isEmailVerified: true,
      },
    });

    return tx.user.create({
      data: {
        authId: auth.id,
        name: DISPLAY_NAME,
      },
      select: { id: true, name: true },
    });
  });

  console.log(`  ✓ Created user ${DISPLAY_NAME} <${EMAIL}>`);
  return user;
}

async function ensureBankAccount(userId: string) {
  const existing = await prisma.account.findFirst({
    where: { userId, name: { equals: BANK_ACCOUNT_NAME, mode: 'insensitive' } },
  });

  if (existing) {
    console.log(`  ✓ Bank account already exists: ${existing.name}`);
    return existing;
  }

  const created = await prisma.account.create({
    data: {
      userId,
      name: BANK_ACCOUNT_NAME,
      type: 'BANK',
      openingBalance: 0,
    },
  });

  console.log(`  ✓ Created BANK account "${BANK_ACCOUNT_NAME}"`);
  return created;
}

async function ensureCategories(userId: string, names: string[]) {
  let created = 0;
  let skipped = 0;
  const map = new Map<string, string>();

  for (const name of names) {
    const existing = await prisma.category.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        type: 'EXPENSE',
      },
    });

    if (existing) {
      skipped += 1;
      map.set(existing.name, existing.id);
      map.set(name, existing.id);
      continue;
    }

    const meta = CATEGORY_META[name] ?? { icon: '📌', color: '#64748B' };
    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type: 'EXPENSE',
        icon: meta.icon,
        color: meta.color,
      },
    });
    created += 1;
    map.set(name, category.id);
  }

  console.log(`  ✓ Categories: created ${created}, skipped ${skipped}`);
  return map;
}

async function main() {
  const raw = readFileSync(INSTRUCTIONS_PATH, 'utf8');
  const { categories, rows } = parseInstructions(raw);

  console.log(`Instructions: ${categories.length} categories, ${rows.length} transactions\n`);

  console.log('1. User');
  const user = await ensureUser();

  console.log('2. Bank account');
  const account = await ensureBankAccount(user.id);

  console.log('3. Categories');
  const categoryMap = await ensureCategories(user.id, categories);

  const unknown = new Set<string>();
  const data = rows.flatMap((row) => {
    const categoryId = categoryMap.get(row.categoryName);
    if (!categoryId) {
      unknown.add(row.categoryName);
      return [];
    }
    return [
      {
        userId: user.id,
        accountId: account.id,
        categoryId,
        type: 'EXPENSE' as const,
        amount: row.amount,
        title: row.title,
        transactionDate: row.date,
        paymentMethod: 'UPI' as const,
      },
    ];
  });

  if (unknown.size > 0) {
    console.log(`  ⚠ Unmapped categories: ${[...unknown].join(', ')}`);
  }

  console.log('4. Transactions');
  const deleted = await prisma.transaction.deleteMany({ where: { userId: user.id } });
  console.log(`  ✓ Deleted ${deleted.count} old transaction(s)`);

  const inserted = await prisma.transaction.createMany({ data });
  const total = data.reduce((sum, row) => sum + row.amount, 0);
  console.log(
    `  ✓ Inserted ${inserted.count} expenses (₹${total.toLocaleString('en-IN')})`,
  );

  const TARGET_BANK_BALANCE = 89_000;
  const bankTx = await prisma.account.findUnique({
    where: { id: account.id },
    select: {
      openingBalance: true,
      transactions: {
        where: { type: { in: ['INCOME', 'EXPENSE'] } },
        select: { type: true, amount: true },
      },
    },
  });
  if (bankTx) {
    const delta = bankTx.transactions.reduce((sum, tx) => {
      const amt = Number(tx.amount);
      return tx.type === 'INCOME' ? sum + amt : sum - amt;
    }, 0);
    await prisma.account.update({
      where: { id: account.id },
      data: { openingBalance: TARGET_BANK_BALANCE - delta },
    });
    console.log(
      `  ✓ Pinned ${account.name} current balance to ₹${TARGET_BANK_BALANCE.toLocaleString('en-IN')}`,
    );
  }

  console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Instructions seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
