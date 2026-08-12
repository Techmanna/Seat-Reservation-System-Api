import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI as string);
    console.log('Connected.');

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection not established');
    }
    
    // Check if index exists
    const collection = db.collection('bookings');
    const indexes = await collection.indexes();
    
    const ticketIdIndex = indexes.find((idx: any) => idx.name === 'ticketId_1' || (idx.key && idx.key.ticketId));
    
    if (ticketIdIndex && ticketIdIndex.name) {
      console.log(`Dropping index ${ticketIdIndex.name}...`);
      await collection.dropIndex(ticketIdIndex.name);
      console.log('Index dropped successfully.');
    } else {
      console.log('No ticketId index found. Nothing to do.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
