import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';

// 检查是否为Vercel构建环境
const isVercelBuild = process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// 模拟数据，用于构建时
const mockRevenue = [
  { month: 'Jan', revenue: 2000 },
  { month: 'Feb', revenue: 1800 },
  { month: 'Mar', revenue: 2200 },
  { month: 'Apr', revenue: 2500 },
  { month: 'May', revenue: 2300 },
  { month: 'Jun', revenue: 3200 },
  { month: 'Jul', revenue: 3500 },
  { month: 'Aug', revenue: 3700 },
  { month: 'Sep', revenue: 2500 },
  { month: 'Oct', revenue: 2800 },
  { month: 'Nov', revenue: 3000 },
  { month: 'Dec', revenue: 4800 },
];

const mockLatestInvoices = [
  {
    id: '1',
    name: '示例客户',
    email: 'user@example.com',
    image_url: '/customers/customer-1.png',
    amount: '$250.00',
  },
  {
    id: '2',
    name: '示例客户2',
    email: 'user2@example.com',
    image_url: '/customers/customer-2.png',
    amount: '$150.00',
  },
  {
    id: '3',
    name: '示例客户3',
    email: 'user3@example.com',
    image_url: '/customers/customer-3.png',
    amount: '$350.00',
  },
];

// 创建一个函数来安全地获取SQL客户端
function getClient() {
  if (!process.env.POSTGRES_URL || isVercelBuild) {
    return null;
  }
  return postgres(process.env.POSTGRES_URL, { ssl: 'require' });
}

// 仅在非构建环境时初始化数据库连接
const sql = getClient();

export async function fetchRevenue() {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟收入数据（构建环境）');
    return mockRevenue;
  }
  
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue[]>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟发票数据（构建环境）');
    return mockLatestInvoices;
  }
  
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

// 模拟卡片数据
const mockCardData = {
  numberOfCustomers: 10,
  numberOfInvoices: 25,
  totalPaidInvoices: '$12,000.00',
  totalPendingInvoices: '$5,000.00',
};

export async function fetchCardData() {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟卡片数据（构建环境）');
    return mockCardData;
  }
  
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfCustomers = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

// 模拟发票数据
const mockFilteredInvoices = [
  {
    id: '1',
    amount: 15000,
    date: '2023-12-01',
    status: 'pending',
    name: '示例客户',
    email: 'user@example.com',
    image_url: '/customers/customer-1.png',
  },
  {
    id: '2',
    amount: 20000,
    date: '2023-11-15',
    status: 'paid',
    name: '示例客户2',
    email: 'user2@example.com',
    image_url: '/customers/customer-2.png',
  },
];

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟筛选发票数据（构建环境）');
    return mockFilteredInvoices;
  }
  
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    return 1; // 只有一页模拟数据
  }
  
  try {
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

// 模拟发票数据
const mockInvoice = {
  id: '1',
  customer_id: '1',
  amount: 150,
  status: 'pending'
};

export async function fetchInvoiceById(id: string) {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟发票详情数据（构建环境）');
    return mockInvoice;
  }
  
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

// 模拟客户数据
const mockCustomers = [
  { id: '1', name: '示例客户' },
  { id: '2', name: '示例客户2' },
];

export async function fetchCustomers() {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟客户数据（构建环境）');
    return mockCustomers;
  }
  
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

// 模拟筛选客户数据
const mockFilteredCustomers = [
  {
    id: '1',
    name: '示例客户',
    email: 'user@example.com',
    image_url: '/customers/customer-1.png',
    total_invoices: 5,
    total_pending: '$2,000.00',
    total_paid: '$5,000.00',
  },
  {
    id: '2',
    name: '示例客户2',
    email: 'user2@example.com',
    image_url: '/customers/customer-2.png',
    total_invoices: 3,
    total_pending: '$1,000.00',
    total_paid: '$4,000.00',
  },
];

export async function fetchFilteredCustomers(query: string) {
  noStore();
  
  // 如果在构建环境或没有数据库连接，返回模拟数据
  if (isVercelBuild || !sql) {
    console.log('使用模拟筛选客户数据（构建环境）');
    return mockFilteredCustomers;
  }
  
  try {
    const data = await sql<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
