import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://arnabc857:99KBr0vPvaNJXgMv@cluster0.8ol7ywm.mongodb.net/mylmsDatabase?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`Connected to database in dev mode`);
    return true;
  } catch (error) {
    console.error('Error connecting to database: ', error);
    throw error;
  }
};

export default connectDB;
