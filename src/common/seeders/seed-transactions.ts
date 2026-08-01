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

// ---------------------------------------------------------------------------
// Fixed IDs (given)
// ---------------------------------------------------------------------------
const USER_ID = '8d72c90c-b582-4480-8d8f-f5f076321383';
const MAIN_ACCOUNT_ID = 'e552ae38-1a46-4d0b-a787-98789167cd05';
const OFFICE_TRAVEL_ACCOUNT_ID = '273a4c2b-c75b-45f3-90e6-e949627ff72f';

// Map the category name as it appears in the raw table -> categoryId
const CATEGORY_ID_MAP: Record<string, string> = {
  PG: 'a29ececa-8f34-40cc-89b4-44f493ada3e9',
  God: 'b639c617-5d4e-4c89-be14-002f732560ec',
  Groceries: '705f6f52-3b75-4d84-84a4-bdcadb2c92eb',
  'Social Expense': '941ea895-2d90-41c9-9881-27d65a88a692',
  Dahod: 'e9bce67e-5467-4d61-befc-1240f97797ca',
  Iron: '29e83f73-24ae-4f13-ae92-c26ad58030d7',
  'Office Travel': 'aa7dae26-aebf-4be8-a0cf-20240d1fbe0b',
  Food: 'e5a5f098-039d-4285-8cb4-b2bb9c65ea7b',
  Entertainment: '3eb12920-6c99-4eec-88a7-40cd758a27dc',
  'Personal Expense': '394cef31-f73d-46a4-9ec8-c535b5224258',
  Home: '0c8da31e-6ff4-44a0-99e7-912cc07b9f1c',
  Recharge: '491b8f68-e7bd-4124-a211-6acfd0a89d85',
  Grooming: 'e3155898-6de8-4c2a-a300-0bc2b5186c50',
  'Local Travel': '77ebc9d4-a9fd-4181-89f7-2bcfc0f1418c',
  Clothing: 'bdca624b-99e4-4145-8a4f-f1449b4b0a85',
  Gadgets: '13138934-aa78-483a-a13c-a53916866777',
  Trip: 'f6961f43-9433-4a06-9c6c-2a2f6668c98f',
  Medical: '1665a381-875f-4387-93e0-3bd712bf97d2',
  'Healthy Food': '924ab00c-907a-4651-8380-7696af9c0308',
  Petrol: '54cc579b-647e-4efc-a4fd-9ddafca60b51',
  Savings: '1e172e24-6ca2-4776-8c92-da0c7592c025',
  SIP: '040ec9e8-ea6f-4b3b-94bc-7c4e1993f821',
  Shoes: 'a795fc63-0d6f-4e3d-b788-31c2895c2e39',
};

// ---------------------------------------------------------------------------
// Raw data (copied verbatim from the provided expense sheet)
// ---------------------------------------------------------------------------
const RAW_TABLE = `
| Rent payment                    |  ₹7,500.00 | PG               | 1/15/25  |
| God                             |     ₹20.00 | God              | 1/19/25  |
| Grocery                         |     ₹20.00 | Groceries        | 1/19/25  |
| Visiting Naroda & Gota          |     ₹70.00 | Social Expense   | 1/19/25  |
| Dahod Jan                       |    ₹406.00 | Dahod            | 1/15/25  |
| Reetha Soap                     |     ₹40.00 | Groceries        | 1/25/25  |
| God                             |     ₹20.00 | God              | 1/25/25  |
| SST January                     |     ₹80.00 | Office Travel    | 1/28/25  |
| January Food                    |    ₹290.00 | Food             | 1/30/25  |
| God                             |     ₹20.00 | God              | 2/1/25   |
| Weekend {Kankaria}              |    ₹295.00 | Entertainment    | 2/9/25   |
| Dahod                           |    ₹402.00 | Dahod            | 2/10/25  |
| Mummy's Bday  Cake              |    ₹400.00 | Personal Expense | 2/10/25  |
| Food, Milk etc                  |    ₹377.00 | Home             | 2/17/25  |
| Food February                   |    ₹320.00 | Food             | 2/28/25  |
| God                             |     ₹20.00 | God              | 2/22/25  |
| Iron                            |     ₹40.00 | Iron             | 2/24/25  |
| Surat & Vadodara                |    ₹526.00 | Social Expense   | 3/2/25   |
| SST February                    |    ₹120.00 | Office Travel    | 2/27/25  |
| Washing Powder                  |     ₹70.00 | Groceries        | 2/1/25   |
| Haircut                         |    ₹100.00 | Grooming         | 1/29/25  |
| Jio Recharge                    |    ₹249.00 | Recharge         | 3/4/25   |
| Jio Recharge                    |    ₹249.00 | Recharge         | 2/4/25   |
| Dahod Travel                    |    ₹625.00 | Dahod            | 3/14/25  |
| Visit Gota                      |     ₹40.00 | Social Expense   | 3/9/25   |
| Visaj Recharge                  |    ₹799.00 | Recharge         | 3/21/25  |
| Dada Recharge                   |    ₹800.00 | Home             | 3/21/25  |
| Interview Paldi                 |     ₹30.00 | Local Travel     | 3/21/25  |
| Food March                      |    ₹200.00 | Food             | 3/31/25  |
| Dahod Travel                    |    ₹410.00 | Dahod            | 3/31/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 2/15/25  |
| SST March                       |    ₹105.00 | Office Travel    | 3/28/25  |
| Dahod Travel                    |    ₹421.00 | Dahod            | 4/13/25  |
| God                             |     ₹20.00 | God              | 4/20/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 3/31/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 4/20/25  |
| Iron                            |     ₹80.00 | Iron             | 4/28/25  |
| Dahod Travel                    |    ₹686.00 | Dahod            | 4/25/25  |
| April : Office Travel           |    ₹680.00 | Office Travel    | 4/28/25  |
| Food April                      |    ₹207.00 | Food             | 4/30/25  |
| Shoes Repair                    |     ₹40.00 | Personal Expense | 4/30/25  |
| Mummy Recharge (3 Months)       |    ₹800.00 | Home             | 5/4/25   |
| Amts Office Travel              |    ₹580.00 | Office Travel    | 5/2/25   |
| Food May                        |    ₹265.00 | Food             | 5/31/25  |
| Ratanpol, Gota & Thaltej Travel |    ₹120.00 | Local Travel     | 5/3/25   |
| Dahod Travel                    |    ₹456.00 | Dahod            | 5/16/25  |
| Dhrumil Wedding                 |    ₹346.00 | Social Expense   | 5/16/25  |
| Visaj (Add on)                  |     ₹39.00 | Recharge         | 5/12/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 5/17/25  |
| Rapido for cheque               |    ₹128.00 | Local Travel     | 5/20/25  |
| HairCut                         |    ₹100.00 | Grooming         | 5/25/25  |
| Iron                            |     ₹48.00 | Iron             | 5/26/25  |
| Dahod Travel                    |    ₹239.00 | Dahod            | 5/30/25  |
| Dahod Travel                    |    ₹213.00 | Dahod            | 6/2/25   |
| Office Travel                   |    ₹540.00 | Office Travel    | 6/4/25   |
| Dahod Travel                    |    ₹416.00 | Dahod            | 6/7/25   |
| Dmart                           |    ₹424.00 | Groceries        | 6/14/25  |
| God                             |     ₹20.00 | God              | 6/14/25  |
| Visiting Maningar               |     ₹35.00 | Social Expense   | 6/13/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 6/16/25  |
| Iron                            |     ₹48.00 | Iron             | 6/16/25  |
| Visaj                           |    ₹800.00 | Recharge         | 6/24/25  |
| Dahod Travel                    |    ₹411.00 | Dahod            | 6/30/25  |
| Hair Oil                        |    ₹225.00 | Groceries        | 7/1/25   |
| Rent Payment                    |  ₹7,500.00 | PG               | 7/15/25  |
| Amts & Travel                   |    ₹545.00 | Office Travel    | 7/7/25   |
| Dahod Travel                    |    ₹411.00 | Dahod            | 7/14/25  |
| Ratlami                         |    ₹995.00 | Home             | 7/12/25  |
| June Food                       |    ₹390.00 | Food             | 7/31/25  |
| Shampoo                         |     ₹10.00 | Groceries        | 7/17/25  |
| God                             |     ₹20.00 | God              | 7/19/25  |
| Salangpur Trip                  |    ₹617.00 | Trip             | 7/26/25  |
| Mummy Recharge                  |    ₹349.00 | Home             | 7/28/25  |
| HairCut                         |    ₹100.00 | Grooming         | 7/30/25  |
| June Food                       |    ₹210.00 | Food             | 6/30/25  |
| God                             |     ₹20.00 | God              | 8/2/25   |
| For Home Dmart                  |    ₹744.00 | Home             | 8/3/25   |
| Dahod                           |    ₹406.00 | Dahod            | 8/8/25   |
| AMTS Travel & Bus Pass          |    ₹655.00 | Office Travel    | 8/18/25  |
| Medicine                        |     ₹20.00 | Groceries        | 8/10/25  |
| Dahod                           |    ₹416.00 | Dahod            | 8/14/25  |
| Digital Transfer                |  ₹7,000.00 | Home             | 8/10/25  |
| Ratlami                         |    ₹670.00 | Home             | 8/9/25   |
| Prachi (Rakhi)                  |  ₹1,900.00 | Social Expense   | 8/10/25  |
| Gillette Razor                  |     ₹25.00 | Groceries        | 8/14/25  |
| Vadodara                        |    ₹325.00 | Social Expense   | 8/16/25  |
| Birthday Treat                  |    ₹100.00 | Personal Expense | 8/17/25  |
| Rent Payment                    |  ₹7,500.00 | PG               | 8/19/25  |
| Digital Transfer                |  ₹1,180.00 | Home             | 8/19/25  |
| God                             |     ₹20.00 | God              | 8/23/25  |
| Visiting Gota                   |     ₹20.00 | Social Expense   | 8/24/25  |
| Dahod                           |    ₹411.00 | Dahod            | 8/29/25  |
| Wafer                           |     ₹40.00 | Food             | 8/29/25  |
| God                             |     ₹20.00 | God              | 9/6/25   |
| Blue Jeans                      |    ₹339.00 | Clothing         | 9/6/25   |
| Shampoo                         |     ₹10.00 | Groceries        | 9/8/25   |
| Daan Peti                       |     ₹10.00 | God              | 9/9/25   |
| Rent Payment                    |  ₹7,500.00 | PG               | 9/15/25  |
| Dahod                           |    ₹413.00 | Dahod            | 9/12/25  |
| Dahod                           |    ₹423.00 | Dahod            | 9/19/25  |
| Amts Pass & Office Travel       |    ₹540.00 | Office Travel    | 9/22/25  |
| Showroom                        | ₹10,338.00 | Home             | 9/13/25  |
| Petrol                          |    ₹200.00 | Home             | 9/21/25  |
| Ice cream                       |    ₹320.00 | Home             | 9/20/25  |
| Mummy Recharge                  |    ₹800.00 | Home             | 9/18/25  |
| My Recharge                     |    ₹800.00 | Recharge         | 9/18/25  |
| Food September                  |    ₹562.00 | Food             | 9/29/25  |
| God & Cow                       |     ₹50.00 | God              | 9/27/25  |
| Food February                   |    ₹560.00 | Food             | 10/31/25 |
| Brush                           |     ₹10.00 | Groceries        | 10/3/25  |
| God                             |     ₹40.00 | God              | 10/4/25  |
| Gota Visit                      |     ₹80.00 | Personal Expense | 10/5/25  |
| HairCut                         |    ₹150.00 | Grooming         | 10/12/25 |
| Dahod                           |    ₹411.00 | Dahod            | 10/10/25 |
| Dahod                           |    ₹244.00 | Dahod            | 10/17/25 |
| Rent Payment                    |  ₹7,500.00 | PG               | 10/15/25 |
| Home + Petrol                   |    ₹599.00 | Home             | 10/24/25 |
| Gaushala                        |    ₹500.00 | Home             | 10/21/25 |
| Kali Chaudas                    |    ₹120.00 | God              | 10/19/25 |
| Mummy                           | ₹10,000.00 | Home             | 10/13/25 |
| Office Travel                   |    ₹155.00 | Office Travel    | 10/31/25 |
| Office Travel                   |    ₹290.00 | Office Travel    | 11/24/25 |
| Dmart Shopping                  |    ₹210.00 | Home             | 11/6/25  |
| Dahod                           |    ₹203.00 | Dahod            | 11/7/25  |
| Home                            |     ₹40.00 | Home             | 11/8/25  |
| Shampoo                         |    ₹295.00 | Home             | 11/13/25 |
| Rent Payment                    |  ₹7,500.00 | PG               | 11/15/25 |
| Rent Payment                    |  ₹7,500.00 | PG               | 12/15/25 |
| Watch Lamination                |     ₹80.00 | Gadgets          | 11/17/25 |
| Food November                   |    ₹670.00 | Food             | 11/28/25 |
| Screen Guard                    |    ₹200.00 | Gadgets          | 11/18/25 |
| Dahod Travel                    |    ₹421.00 | Dahod            | 11/21/25 |
| Earphone & Back Cover           |    ₹300.00 | Gadgets          | 11/21/25 |
| Phone EMI                       |  ₹7,000.00 | Gadgets          | 11/22/25 |
| Dhd Expense                     |    ₹195.00 | Home             | 11/29/25 |
| Dahod Travel                    |    ₹411.00 | Dahod            | 11/27/25 |
| Showroom Agreement              |  ₹1,500.00 | Home             | 11/26/25 |
| Laptop Stand                    |    ₹276.00 | Gadgets          | 12/1/25  |
| Mummy's Sandal                  |    ₹599.00 | Home             | 12/3/25  |
| Office Travel                   |    ₹560.00 | Office Travel    | 12/26/25 |
| Dahod                           |    ₹411.00 | Dahod            | 12/5/25  |
| Food & Grocery                  |    ₹415.00 | Home             | 12/7/25  |
| Food December                   |    ₹625.00 | Food             | 12/21/25 |
| Weekend {Dhurandhar}            |    ₹377.00 | Entertainment    | 12/13/25 |
| Dmart                           |  ₹2,244.00 | Home             | 12/14/25 |
| God                             |     ₹40.00 | God              | 12/13/25 |
| Phone EMI                       |  ₹7,000.00 | Gadgets          | 12/16/25 |
| Journal Book                    |     ₹98.00 | Personal Expense | 12/21/25 |
| Relative Visit                  |     ₹20.00 | Social Expense   | 12/21/25 |
| Dahod Visit                     |    ₹411.00 | Dahod            | 12/26/25 |
| Screen guard                    |    ₹100.00 | Gadgets          | 12/26/25 |
| Hair Cut                        |    ₹150.00 | Grooming         | 12/27/25 |
| Home                            |    ₹212.00 | Home             | 12/27/25 |
| Dahod                           |    ₹420.00 | Dahod            | 1/3/26   |
| PG Rent                         |  ₹7,500.00 | PG               | 1/15/26  |
| Cow                             |     ₹20.00 | God              | 1/1/26   |
| Namaste DSA Course              |  ₹3,270.00 | Personal Expense | 1/1/26   |
| Food                            |    ₹544.00 | Food             | 1/23/26  |
| Office Travel                   |    ₹465.00 | Office Travel    | 1/30/26  |
| Dahod                           |    ₹420.00 | Dahod            | 1/13/26  |
| Visiting Gota                   |     ₹40.00 | Social Expense   | 1/11/26  |
| God                             |     ₹40.00 | God              | 1/10/26  |
| Mask                            |     ₹30.00 | Clothing         | 1/15/26  |
| Neeman Shoes                    |  ₹2,339.00 | Shoes            | 1/18/26  |
| Loafer Socks                    |     ₹79.00 | Clothing         | 1/18/26  |
| Dahod Travel                    |    ₹473.00 | Dahod            | 1/23/26  |
| Dahod Travel                    |    ₹420.00 | Dahod            | 1/30/26  |
| Socks                           |    ₹100.00 | Personal Expense | 1/25/26  |
| Petrol                          |    ₹400.00 | Petrol           | 1/25/26  |
| Home Expense                    |  ₹4,946.00 | Home             | 1/26/26  |
| Office Travel                   |    ₹455.00 | Office Travel    | 2/28/26  |
| Dahod x 3                       |  ₹1,060.00 | Dahod            | 2/27/26  |
| Pg                              |  ₹7,500.00 | PG               | 2/15/26  |
| Junk Food                       |    ₹580.00 | Food             | 2/23/26  |
| D's Home                        |     ₹30.00 | Social Expense   | 2/7/26   |
| Jaggery                         |    ₹185.00 | Home             | 2/10/26  |
| Dakor & Home                    |  ₹1,442.00 | Home             | 2/15/26  |
| Phone Emi                       |  ₹7,000.00 | Gadgets          | 2/12/26  |
| Dada Recharge                   |    ₹800.00 | Home             | 2/11/26  |
| Haircut                         |    ₹120.00 | Grooming         | 2/28/26  |
| Amts                            |    ₹513.00 | Office Travel    | 3/31/26  |
| Lassi & IceCream & Shake        |    ₹120.00 | Home             | 3/4/26   |
| HouseHold Work                  |    ₹100.00 | Home             | 2/28/26  |
| Seeds (Dmart)                   |    ₹174.00 | Healthy Food     | 3/7/26   |
| Visaj Recharge                  |    ₹899.00 | Recharge         | 3/5/26   |
| Banana                          |     ₹50.00 | Healthy Food     | 3/8/26   |
| Weekend Enjoy                   |     ₹81.00 | Entertainment    | 3/14/26  |
| Banana                          |     ₹40.00 | Healthy Food     | 3/15/26  |
| PG Rent                         |  ₹7,500.00 | PG               | 3/15/26  |
| Rapido                          |     ₹24.00 | Local Travel     | 3/21/26  |
| Kanya Jamanvar                  |    ₹500.00 | Social Expense   | 3/21/26  |
| Junk Extreme Eating             |  ₹1,119.00 | Food             | 3/30/26  |
| Rent Payment                    |  ₹7,500.00 | PG               | 4/15/26  |
| Office Travel                   |    ₹425.00 | Office Travel    | 4/30/26  |
| Dahod Travel                    |    ₹294.00 | Dahod            | 3/26/26  |
| Mr  Cake                        |     ₹80.00 | Home             | 3/28/26  |
| Mohan Snacks                    |     ₹60.00 | Home             | 3/29/26  |
| Petrol                          |    ₹100.00 | Petrol           | 3/29/26  |
| Mochi                           |     ₹20.00 | Personal Expense | 3/29/26  |
| Rapido                          |     ₹47.00 | Local Travel     | 4/3/26   |
| Clean Shave                     |     ₹60.00 | Grooming         | 4/3/26   |
| Shaving                         |     ₹60.00 | Grooming         | 3/15/26  |
| Dahod Travel                    |    ₹450.00 | Dahod            | 4/10/26  |
| Junk Food                       |  ₹1,325.00 | Food             | 4/30/26  |
| Dahod                           |    ₹450.00 | Dahod            | 4/17/26  |
| Dahod                           |    ₹450.00 | Dahod            | 4/24/26  |
| Mochi                           |     ₹10.00 | Personal Expense | 4/11/26  |
| Cheese                          |     ₹20.00 | Healthy Food     | 4/15/26  |
| Rapido Travel                   |    ₹104.00 | Local Travel     | 4/15/26  |
| Savings                         |  ₹8,000.00 | Savings          | 4/12/26  |
| SIP                             |  ₹2,000.00 | SIP              | 4/15/26  |
| Realme Air buds                 |  ₹1,218.00 | Gadgets          | 4/10/26  |
| Saloon                          |    ₹100.00 | Grooming         | 1/1/26   |
| Rapido                          |     ₹53.00 | Local Travel     | 4/21/26  |
| Box Cricket                     |    ₹228.00 | Entertainment    | 4/23/26  |
| Dhurandhar                      |    ₹371.00 | Entertainment    | 4/6/26   |
| Trimmer                         |    ₹854.00 | Personal Expense | 4/30/26  |
| Surat                           |    ₹170.00 | Trip             | 5/1/26   |
| Fast Food                       |  ₹1,325.00 | Food             | 5/29/26  |
| PG Rent                         |  ₹7,500.00 | PG               | 5/15/26  |
| Office Travel                   |    ₹405.00 | Office Travel    | 5/29/26  |
| Dahod                           |    ₹440.00 | Dahod            | 5/8/26   |
| Dahod                           |    ₹440.00 | Dahod            | 5/12/26  |
| Box Cricket                     |    ₹242.00 | Personal Expense | 5/6/26   |
| Amul, Snacks etc                |    ₹543.00 | Social Expense   | 5/14/26  |
| Hair Cut                        |    ₹120.00 | Grooming         | 5/15/26  |
| SIP                             |  ₹2,000.00 | SIP              | 5/16/26  |
| Savings                         | ₹15,000.00 | Savings          | 5/16/26  |
| Bluetooth Speaker               |  ₹1,118.00 | Personal Expense | 5/8/26   |
| Dmart (Seeds)                   |    ₹189.00 | Healthy Food     | 5/16/26  |
| Box Cricket                     |    ₹232.00 | Personal Expense | 5/21/26  |
| Rapido & Auto                   |     ₹80.00 | Local Travel     | 5/25/26  |
| Donation                        |     ₹10.00 | God              | 5/29/26  |
| Dahod                           |    ₹417.00 | Dahod            | 5/29/26  |
| Auto & Brts & Naroda            |     ₹90.00 | Local Travel     | 6/7/26   |
| Office Amts                     |    ₹405.00 | Office Travel    | 6/30/26  |
| Box Cricket + Travel            |    ₹158.00 | Personal Expense | 6/3/26   |
| Visaj Recharge                  |    ₹859.00 | Recharge         | 6/4/26   |
| Eye Drops,Paracetamol,Limca     |     ₹65.00 | Medical          | 6/9/26   |
| Dahod                           |    ₹420.00 | Dahod            | 6/13/26  |
| SIP                             |  ₹2,000.00 | SIP              | 6/15/26  |
| PG Rent                         |  ₹8,000.00 | PG               | 6/15/26  |
| Blood Report                    |  ₹1,900.00 | Medical          | 6/22/26  |
| Grocery & Extra                 |  ₹2,662.00 | Home             | 6/21/26  |
| Toothpaste & Soap               |    ₹181.00 | Groceries        | 6/21/26  |
| Underwear                       |    ₹217.00 | Clothing         | 6/21/26  |
| June Food                       |  ₹1,012.00 | Food             | 6/24/26  |
| Dahod                           |    ₹443.00 | Dahod            | 6/26/26  |
| Social Expense of All           |  ₹2,734.00 | Social Expense   | 6/27/26  |
| Saloon                          |     ₹80.00 | Grooming         | 6/27/26  |
| Dhd travel + Auto               |    ₹846.00 | Dahod            | 7/31/26  |
| Limdi Travel + Social BT        |    ₹152.00 | Social Expense   | 7/4/26   |
| Social BT                       |    ₹100.00 | Social Expense   | 7/5/26   |
| 2 Protien Bar Pack + Peanuts    |    ₹608.00 | Healthy Food     | 7/5/26   |
| Vitamin D3 (40) + B12(60)       |    ₹863.00 | Medical          | 7/7/26   |
| PG Rent                         |  ₹8,000.00 | PG               | 7/15/26  |
| SIP                             |  ₹4,000.00 | SIP              | 7/15/26  |
| Showroom                        |  ₹9,000.00 | Home             | 7/11/26  |
| Navkar Meter Box Bill           |  ₹3,500.00 | Home             | 7/13/26  |
| Ball for D                      |     ₹40.00 | Social Expense   | 7/18/26  |
| Grocery Veg & etc               |  ₹1,111.00 | Home             | 7/19/26  |
| Ratlami Prachi                  |    ₹605.00 | Social Expense   | 7/13/26  |
| Office + Rain Travel            |    ₹405.00 | Office Travel    | 7/31/26  |
| Vadodara-Food-Rapido            |    ₹455.00 | Social Expense   | 7/26/26  |
| Junk                            |    ₹815.00 | Food             | 7/30/26  |
`;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[₹,]/g, '').trim());
}

/** Parses M/D/YY -> Date (UTC midnight), assuming 20YY. */
function parseDate(raw: string): Date {
  const [m, d, y] = raw.trim().split('/').map((n) => parseInt(n, 10));
  const fullYear = 2000 + y;
  return new Date(Date.UTC(fullYear, m - 1, d));
}

interface ParsedRow {
  title: string;
  amount: number;
  categoryName: string;
  date: Date;
}

function parseRawTable(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    // Split on pipes, drop the leading/trailing empty strings created by the
    // leading/trailing '|' characters.
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.length < 4) continue;

    const [name, amountRaw, category, dateRaw] = cells;

    // Skip malformed / placeholder rows (missing name, amount or date).
    if (!name || !amountRaw || !category || !dateRaw) continue;

    const amount = parseAmount(amountRaw);
    if (Number.isNaN(amount)) continue;

    let date: Date;
    try {
      date = parseDate(dateRaw);
    } catch {
      continue;
    }
    if (Number.isNaN(date.getTime())) continue;

    rows.push({ title: name, amount, categoryName: category, date });
  }

  return rows;
}

function resolveAccountId(categoryName: string): string {
  return categoryName === 'Office Travel'
    ? OFFICE_TRAVEL_ACCOUNT_ID
    : MAIN_ACCOUNT_ID;
}

function resolvePaymentMethod(categoryName: string): 'CASH' | 'UPI' {
  return categoryName === 'Office Travel' ? 'CASH' : 'UPI';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const parsedRows = parseRawTable(RAW_TABLE);
  console.log(`Parsed ${parsedRows.length} rows from the raw table.\n`);

  let created = 0;
  let skippedUnknownCategory = 0;
  const unknownCategories = new Set<string>();

  const data: {
    userId: string;
    accountId: string;
    categoryId: string;
    type: 'EXPENSE';
    amount: number;
    title: string;
    transactionDate: Date;
    paymentMethod: 'CASH' | 'UPI';
  }[] = [];

  for (const row of parsedRows) {
    const categoryId = CATEGORY_ID_MAP[row.categoryName];

    if (!categoryId) {
      skippedUnknownCategory += 1;
      unknownCategories.add(row.categoryName);
      continue;
    }

    data.push({
      userId: USER_ID,
      accountId: resolveAccountId(row.categoryName),
      categoryId,
      type: 'EXPENSE',
      amount: row.amount,
      title: row.title,
      transactionDate: row.date,
      paymentMethod: resolvePaymentMethod(row.categoryName),
    });
  }

  if (unknownCategories.size > 0) {
    console.log(
      `⚠ Skipping ${skippedUnknownCategory} row(s) with unmapped categories: ${[...unknownCategories].join(', ')}`,
    );
  }

  const result = await prisma.transaction.createMany({
    data,
  });

  created = result.count;

  console.log(`\n✓ Inserted ${created} transactions for user ${USER_ID}.`);
}

main()
  .catch((error) => {
    console.error('Transaction seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });