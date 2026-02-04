// utils/seedDb.js
import User from '../models/user.model.js';

const seedDatabase = async () => {
  try {    
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
      console.log('Test user created successfully');
    } else {
      console.log('Users already exist in database');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

seedDatabase();
