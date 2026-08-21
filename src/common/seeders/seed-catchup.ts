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

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const UPPANCHAL_AUTH_ID = '019ff0db-1f23-7638-97c2-45112eb1039d';
const VISAJ_AUTH_ID = '019eb560-7006-7220-8e96-38a3e2602478';
const UPPANCHAL_BANK_TARGET = 89_000;
const OFFICE_TRAVEL_TRANSFER_NOTE = 'Office travel (wallet top-up)';

const UPPANCHAL_ROWS = `
20-Jul-26	Ratlami & Jiralu Guest	₹240.00	Social Expense
20-Jul-26	Farsan	₹90.00	Snacks & Farsan
20-Jul-26	Vegetable	₹100.00	Vegetable & Fruit
20-Jul-26	Petrol	₹200.00	Petrol
22-Jul-26	Maid	₹200.00	Maid
22-Jul-26		₹20.00	Travel
22-Jul-26		₹30.00	Vegetable & Fruit
22-Jul-26		₹40.00	Clothes
24-Jul-26		₹164.00	Milk
24-Jul-26		₹200.00	Social Expense
25-Jul-26		₹165.00	Groceries
25-Jul-26		₹310.00	Vegetable & Fruit
25-Jul-26		₹280.00	Vegetable & Fruit
26-Jul-26		₹50.00	Social Expense
27-Jul-26		₹140.00	Milk
28-Jul-26		₹100.00	Vegetable & Fruit
29-Jul-26		₹970.00	Gas
29-Jul-26		₹1,000.00	Social Expense
30-Jul-26		₹595.00	Groceries
30-Jul-26		₹20.00	Travel
30-Jul-26		₹1,000.00	Clothes
30-Jul-26		₹1,001.00	Social Expense
30-Jul-26		₹140.00	Milk
1-Aug-26		₹140.00	Milk
1-Aug-26		₹700.00	Maid
2-Aug-26		₹100.00	God
2-Aug-26		₹40.00	Travel
2-Aug-26		₹1,700.00	Social Expense
4-Aug-26		₹500.00	Clothes
5-Aug-26		₹155.00	Milk
5-Aug-26		₹175.00	Travel
5-Aug-26		₹100.00	Snacks & Farsan
6-Aug-26		₹55.00	God
6-Aug-26		₹100.00	Social Expense
7-Aug-26		₹300.00	Vegetable & Fruit
7-Aug-26		₹250.00	Snacks & Farsan
7-Aug-26		₹100.00	Social Expense
7-Aug-26		₹50.00	Vegetable & Fruit
7-Aug-26		₹60.00	Repairing
7-Aug-26		₹100.00	Maid
8-Aug-26		₹130.00	Vegetable & Fruit
9-Aug-26		₹200.00	Social Expense
10-Aug-26		₹25.00	God
10-Aug-26		₹140.00	Milk
10-Aug-26		₹680.00	Groceries
10-Aug-26		₹100.00	Maid
13-Aug-26		₹75.00	Medical
14-Aug-26		₹10.00	God
14-Aug-26		₹140.00	Milk
15-Aug-26		₹500.00	Social Expense
15-Aug-26		₹200.00	Groceries
`;

const VISAJ_ROWS = `
7-Aug-26	Office Travel	₹90.00	Office Travel
8-Aug-26	Milk + Anaj	₹290.00	Home
8-Aug-26	Sandwich Preparation	₹329.00	Home
9-Aug-26	Laptop Adapter	₹654.00	Gadgets
10-Aug-26	Dahod	₹450.00	Dahod
12-Aug-26	Bday Treat	₹585.00	Social Expense
12-Aug-26	Packaged	₹30.00	Food
13-Aug-26	Adi	₹170.00	Social Expense
14-Aug-26	Office Travel	₹70.00	Office Travel
14-Aug-26	Mithai	₹240.00	Home
14-Aug-26	Dhd Travel	₹433.00	Dahod
14-Aug-26	Mummy Recharge	₹666.00	Home
15-Aug-26	PG	₹8,000.00	PG
15-Aug-26	Protein Ladoo	₹540.00	Healthy Food
15-Aug-26	SIP	₹4,000.00	SIP
15-Aug-26	Pav Bhaji	₹110.00	Food
16-Aug-26	Milk	₹140.00	Home
21-Aug-26	Dhd Travel	₹433.00	Dahod
21-Aug-26	Office Travel	₹85.00	Office Travel
31-Aug-26	Junk Food (Last : 20th)	₹375.00	Food
31-Aug-26	Social August	₹1,342.00	Social Expense
`;

const CATEGORY_ALIASES: Record<string, string> = {
  'Social Expense': 'Social',
  'Personal Expense': 'Personal',
};

type ParsedRow = {
  title: string;
  amount: number;
  categoryName: string;
  date: Date;
};

function parseSheetDate(raw: string): Date {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!match) throw new Error(`Bad date: ${raw}`);
  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  const year = 2000 + Number(match[3]);
  if (month == null) throw new Error(`Bad month: ${raw}`);
  return new Date(Date.UTC(year, month, day));
}

function parseRows(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells = trimmed.split('\t');
    if (cells.length < 4) {
      throw new Error(`Bad row: ${trimmed}`);
    }

    const [dateRaw, titleRaw, amountRaw, categoryRaw] = cells;
    const amount = parseFloat(amountRaw.replace(/[₹,]/g, '').trim());
    if (Number.isNaN(amount)) throw new Error(`Bad amount: ${trimmed}`);

    const categoryName = categoryRaw.trim();
    rows.push({
      title: titleRaw.trim() || categoryName,
      amount,
      categoryName,
      date: parseSheetDate(dateRaw),
    });
  }

  return rows;
}

async function resolveUser(authId: string) {
  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: {
      email: true,
      user: { select: { id: true, name: true } },
    },
  });

  if (!auth?.user) {
    throw new Error(`No user for auth id ${authId}`);
  }

  return { email: auth.email, ...auth.user };
}

async function loadCategoryMap(userId: string) {
  const categories = await prisma.category.findMany({
    where: { userId, type: 'EXPENSE' },
    select: { id: true, name: true },
  });

  const map = new Map<string, string>();
  for (const category of categories) {
    map.set(category.name.toLowerCase(), category.id);
  }
  return map;
}

function categoryIdFor(map: Map<string, string>, name: string): string {
  const direct = map.get(name.toLowerCase());
  if (direct) return direct;

  const alias = CATEGORY_ALIASES[name];
  if (alias) {
    const aliased = map.get(alias.toLowerCase());
    if (aliased) return aliased;
  }

  throw new Error(`Missing expense category: ${name}`);
}

async function computeCurrentBalance(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      name: true,
      openingBalance: true,
      transactions: {
        where: { type: { in: ['INCOME', 'EXPENSE'] } },
        select: { type: true, amount: true },
      },
      transfersFrom: { select: { amount: true } },
      transfersTo: { select: { amount: true } },
    },
  });

  if (!account) return null;

  const txDelta = account.transactions.reduce((sum, tx) => {
    const amt = Number(tx.amount);
    return tx.type === 'INCOME' ? sum + amt : sum - amt;
  }, 0);
  const transfersOut = account.transfersFrom.reduce(
    (sum, tr) => sum + Number(tr.amount),
    0,
  );
  const transfersIn = account.transfersTo.reduce(
    (sum, tr) => sum + Number(tr.amount),
    0,
  );

  return {
    name: account.name,
    openingBalance: Number(account.openingBalance),
    currentBalance:
      Number(account.openingBalance) + txDelta - transfersOut + transfersIn,
  };
}

async function pinAccountBalance(accountId: string, target: number) {
  const account = await computeCurrentBalance(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const delta = account.currentBalance - account.openingBalance;
  await prisma.account.update({
    where: { id: accountId },
    data: { openingBalance: target - delta },
  });
}

async function seedUppanchal() {
  const user = await resolveUser(UPPANCHAL_AUTH_ID);
  const rows = parseRows(UPPANCHAL_ROWS);
  const bank = await prisma.account.findFirst({
    where: { userId: user.id, type: 'BANK', isArchived: false },
    select: { id: true, name: true },
  });

  if (!bank) throw new Error('Uppanchal bank account not found');

  const categoryMap = await loadCategoryMap(user.id);
  const fromDate = new Date(Date.UTC(2026, 6, 20));

  const deleted = await prisma.transaction.deleteMany({
    where: {
      userId: user.id,
      type: 'EXPENSE',
      transactionDate: { gte: fromDate },
    },
  });

  const data = rows.map((row) => ({
    userId: user.id,
    accountId: bank.id,
    categoryId: categoryIdFor(categoryMap, row.categoryName),
    type: 'EXPENSE' as const,
    amount: row.amount,
    title: row.title,
    transactionDate: row.date,
    paymentMethod: 'UPI' as const,
  }));

  await prisma.transaction.createMany({ data });
  await pinAccountBalance(bank.id, UPPANCHAL_BANK_TARGET);

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const bankAfter = await computeCurrentBalance(bank.id);

  console.log(`\nUppanchal (${user.email})`);
  console.log(`  Deleted from 20-Jul-26: ${deleted.count}`);
  console.log(`  Inserted ${data.length} expenses (₹${total.toLocaleString('en-IN')})`);
  console.log(
    `  ${bankAfter?.name}: current ₹${bankAfter?.currentBalance.toLocaleString('en-IN')}`,
  );
}

async function seedVisaj() {
  const user = await resolveUser(VISAJ_AUTH_ID);
  const rows = parseRows(VISAJ_ROWS);
  const [bank, cash] = await Promise.all([
    prisma.account.findFirst({
      where: { userId: user.id, type: 'BANK', isArchived: false },
      select: { id: true, name: true },
    }),
    prisma.account.findFirst({
      where: { userId: user.id, type: 'WALLET', isArchived: false },
      select: { id: true, name: true },
    }),
  ]);

  if (!bank) throw new Error('Visaj bank account not found');
  if (!cash) throw new Error('Visaj cash account not found');

  const categoryMap = await loadCategoryMap(user.id);
  const augustStart = new Date(Date.UTC(2026, 7, 1));
  const septemberStart = new Date(Date.UTC(2026, 8, 1));

  const deletedTx = await prisma.transaction.deleteMany({
    where: {
      userId: user.id,
      type: 'EXPENSE',
      transactionDate: { gte: augustStart, lt: septemberStart },
    },
  });

  const deletedTransfers = await prisma.transfer.deleteMany({
    where: {
      userId: user.id,
      fromAccountId: bank.id,
      toAccountId: cash.id,
      note: OFFICE_TRAVEL_TRANSFER_NOTE,
      transferDate: { gte: augustStart, lt: septemberStart },
    },
  });

  const expenseData = rows.map((row) => {
    const isOfficeTravel = row.categoryName === 'Office Travel';
    return {
      userId: user.id,
      accountId: isOfficeTravel ? cash.id : bank.id,
      categoryId: categoryIdFor(categoryMap, row.categoryName),
      type: 'EXPENSE' as const,
      amount: row.amount,
      title: row.title,
      transactionDate: row.date,
      paymentMethod: isOfficeTravel ? ('CASH' as const) : ('UPI' as const),
    };
  });

  await prisma.transaction.createMany({ data: expenseData });

  const officeTravel = rows.filter((row) => row.categoryName === 'Office Travel');
  if (officeTravel.length > 0) {
    await prisma.transfer.createMany({
      data: officeTravel.map((row) => ({
        userId: user.id,
        fromAccountId: bank.id,
        toAccountId: cash.id,
        amount: row.amount,
        note: OFFICE_TRAVEL_TRANSFER_NOTE,
        transferDate: row.date,
      })),
    });
  }

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const bankAfter = await computeCurrentBalance(bank.id);
  const cashAfter = await computeCurrentBalance(cash.id);

  console.log(`\nVisaj (${user.email})`);
  console.log(`  Deleted Aug expenses: ${deletedTx.count}`);
  console.log(`  Deleted Aug office-travel top-ups: ${deletedTransfers.count}`);
  console.log(`  Inserted ${expenseData.length} expenses (₹${total.toLocaleString('en-IN')})`);
  console.log(`  Office Travel on Cash: ${officeTravel.length}`);
  console.log(
    `  ${bankAfter?.name}: current ₹${bankAfter?.currentBalance.toLocaleString('en-IN')}`,
  );
  console.log(
    `  ${cashAfter?.name}: current ₹${cashAfter?.currentBalance.toLocaleString('en-IN')}`,
  );
}

async function main() {
  await seedUppanchal();
  await seedVisaj();
}

main()
  .catch((error) => {
    console.error('Catch-up seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
