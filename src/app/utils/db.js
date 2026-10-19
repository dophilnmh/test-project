import mongoose from 'mongoose';
import dns from 'node:dns';

let isConnected = false; // global connection flag
let connectionPromise = null;

const connect = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB already connected.');
    return;
  }

  if (isConnected && mongoose.connection.readyState !== 1) {
    isConnected = false;
  }

  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    console.log('✅ MongoDB connection already established.');
    return;
  }

  try {
    const mongoURI = (
      process.env.MONGODB_URI ||
      process.env.MONGODB_URL ||
      ''
    ).trim();

    if (!mongoURI) {
      throw new Error(
        '❌ MongoDB URI is not defined. Please add MONGODB_URI to your .env or .env.local file'
      );
    }

    console.log(
      '🔗 Attempting MongoDB connection with URI:',
      mongoURI.substring(0, 20) + '...'
    );

    const dnsServers = (process.env.MONGO_DNS_SERVERS || '')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);

    if (dnsServers.length > 0) {
      dns.setServers(dnsServers);
      console.log('🌐 Using custom DNS servers for MongoDB:', dnsServers);
    }

    if (!connectionPromise) {
      connectionPromise = mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 15000,
      });
    }

    await connectionPromise;
    isConnected = true;
    console.log('✅ MongoDB connection established successfully.');
  } catch (error) {
    const isSrvDnsError =
      error?.message?.includes('querySrv ECONNREFUSED') ||
      error?.message?.includes('ENOTFOUND') ||
      error?.code === 'ECONNREFUSED';

    console.error('❌ MongoDB connection error details:', {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });

    if (isSrvDnsError) {
      console.error(
        '💡 DNS SRV lookup failed. This is usually a network or DNS resolver issue on the machine. Try a non-SRV Mongo URI (mongodb://...) or switch DNS to 1.1.1.1 / 8.8.8.8.'
      );
    }

    connectionPromise = null;
    throw error;
  }
};

export default connect;
