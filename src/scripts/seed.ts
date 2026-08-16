import { connectDB, closeDB } from '../config/database';
import { User, UserRole, PartnerVerificationStatus } from '../models/User';
import { Product, ProductCategory } from '../models/Product';
import { PartnerWallet } from '../models/PartnerWallet';
import { hashPassword } from '../utils/security';
import { env } from '../config/env';
import { logger } from '../config/logger';

async function seed() {
  logger.info('Starting Database Seeder...');
  await connectDB();

  // 1. Seed Admin User
  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({
      email: adminEmail,
      hashed_password: await hashPassword('Admin@123'),
      full_name: 'Super Admin',
      phone: '9999900000',
      role: UserRole.ADMIN,
      is_active: true,
      is_superuser: true,
      is_email_verified: true,
    });
    await admin.save();
    logger.info(`✅ Seeded Admin User: ${adminEmail} (Password: Admin@123)`);
  } else {
    logger.info(`ℹ️ Admin User already exists: ${adminEmail}`);
  }

  // 2. Seed Delivery Partner
  const partnerEmail = 'rider1@example.com';
  let partner = await User.findOne({ email: partnerEmail });
  if (!partner) {
    partner = new User({
      email: partnerEmail,
      hashed_password: await hashPassword('Partner@123'),
      full_name: 'Rahul Sharma (Delivery Hero)',
      phone: '9876543210',
      role: UserRole.PARTNER,
      is_active: true,
      is_email_verified: true,
      is_gps_enabled: true,
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Central Campus Gate 1',
      },
      partner_profile: {
        vehicle_type: 'Motorcycle',
        vehicle_number: 'KA-01-AB-1234',
        driving_license_number: 'DL-KA0120200012345',
        verification_status: PartnerVerificationStatus.APPROVED,
        is_online: true,
        upi_id: 'rahul@oksbi',
        approved_at: new Date(),
      },
    });
    await partner.save();

    await PartnerWallet.findOneAndUpdate(
      { partner_id: partner._id.toString() },
      {
        partner_id: partner._id.toString(),
        total_balance: 350.0,
        pending_withdrawal_balance: 0.0,
        total_withdrawn: 1200.0,
      },
      { upsert: true }
    );

    logger.info(`✅ Seeded Approved Delivery Partner: ${partnerEmail} (Password: Partner@123)`);
  }

  // 3. Seed Sample Customer User
  const customerEmail = 'customer@example.com';
  let customer = await User.findOne({ email: customerEmail });
  if (!customer) {
    customer = new User({
      email: customerEmail,
      hashed_password: await hashPassword('Customer@123'),
      full_name: 'Ananya Roy',
      phone: '9123456780',
      role: UserRole.USER,
      college: 'National Engineering College',
      address: 'Girls Hostel B, Room 314',
      is_active: true,
      is_email_verified: true,
    });
    await customer.save();
    logger.info(`✅ Seeded Customer: ${customerEmail} (Password: Customer@123)`);
  }

  // 4. Seed Products
  const seedProducts = [
    // Snacks
    {
      name: 'Lays Magic Masala (50g)',
      category: ProductCategory.SNACKS,
      description: 'Spicy and crunchy potato chips.',
      price: 20.0,
      unit: 'pack',
      stock_quantity: 150,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500',
      tags: ['chips', 'spicy', 'snacks'],
      search_keywords: ['lays', 'chips', 'crisps', 'snack', 'masala'],
    },
    {
      name: 'Kurkure Masala Munch (90g)',
      category: ProductCategory.SNACKS,
      description: 'Crispy, namkeen puffed snack with classic Indian spices.',
      price: 30.0,
      unit: 'pack',
      stock_quantity: 200,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810a9?w=500',
      tags: ['kurkure', 'namkeen', 'spicy'],
      search_keywords: ['kurkure', 'namkeen', 'snack'],
    },
    {
      name: 'Maggi 2-Minute Noodles (70g)',
      category: ProductCategory.SNACKS,
      description: 'Instant tastemaker masala noodles.',
      price: 14.0,
      unit: 'pack',
      stock_quantity: 500,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500',
      tags: ['maggi', 'instant', 'noodles'],
      search_keywords: ['maggi', 'noodles', 'instant noodles', 'hot'],
    },
    // Beverages
    {
      name: 'Coca-Cola Can (300ml)',
      category: ProductCategory.BEVERAGES,
      description: 'Chilled sparkling refreshing cola.',
      price: 40.0,
      unit: 'can',
      stock_quantity: 120,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500',
      tags: ['cold drink', 'cola', 'soda'],
      search_keywords: ['coke', 'coca cola', 'cold drink', 'soda'],
    },
    {
      name: 'Red Bull Energy Drink (250ml)',
      category: ProductCategory.BEVERAGES,
      description: 'Vitalizes body and mind during late-night study sessions.',
      price: 125.0,
      unit: 'can',
      stock_quantity: 80,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
      tags: ['energy drink', 'redbull', 'caffeine'],
      search_keywords: ['redbull', 'energy', 'drink', 'caffeine'],
    },
    {
      name: 'Amul Kool Kesar Milk (200ml)',
      category: ProductCategory.BEVERAGES,
      description: 'Delicious flavored saffron milk beverage.',
      price: 30.0,
      unit: 'bottle',
      stock_quantity: 90,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500',
      tags: ['milk', 'amul', 'kesar'],
      search_keywords: ['amul', 'milk', 'kesar milk', 'drink'],
    },
    // Cakes
    {
      name: 'Chocolate Truffle Pastry',
      category: ProductCategory.CAKES,
      description: 'Rich dark chocolate layered pastry with silky ganache.',
      price: 75.0,
      unit: 'piece',
      stock_quantity: 30,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
      tags: ['cake', 'pastry', 'chocolate', 'dessert'],
      search_keywords: ['cake', 'chocolate', 'pastry', 'sweet'],
    },
    {
      name: 'Red Velvet Mini Cake (250g)',
      category: ProductCategory.CAKES,
      description: 'Moist red velvet sponge with cream cheese frosting.',
      price: 199.0,
      unit: 'cake',
      stock_quantity: 20,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=500',
      tags: ['red velvet', 'birthday', 'cake'],
      search_keywords: ['red velvet', 'cake', 'birthday'],
    },
    // Stationery
    {
      name: 'Classmate Notebook (Long Book, 172 Pages)',
      category: ProductCategory.STATIONERY,
      description: 'Smooth ruled pages, spiral soft cover.',
      price: 65.0,
      unit: 'book',
      stock_quantity: 300,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500',
      tags: ['notebook', 'classmate', 'study'],
      search_keywords: ['notebook', 'copy', 'book', 'paper'],
    },
    {
      name: 'Hauser XO Ball Pen (Pack of 5, Blue)',
      category: ProductCategory.STATIONERY,
      description: 'Ultra smooth hybrid ink writing pen.',
      price: 50.0,
      unit: 'pack',
      stock_quantity: 250,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1585336261026-7f9a888c3a9d?w=500',
      tags: ['pen', 'hauser', 'blue'],
      search_keywords: ['pen', 'hauser', 'ball pen', 'writing'],
    },
  ];

  for (const item of seedProducts) {
    const existing = await Product.findOne({ name: item.name });
    if (!existing) {
      await new Product(item).save();
    }
  }

  logger.info(`✅ Seeded ${seedProducts.length} catalog products across categories.`);
  logger.info('🎉 Database Seeding Completed Successfully!');

  await closeDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error(`Seeding failed: ${err.message}`, err);
  process.exit(1);
});
