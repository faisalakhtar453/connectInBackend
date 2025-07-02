const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/database');
const adminApiRoutes = require('./routes/adminroutes');
const userroutes = require('./routes/userroutes');
const extensionroute = require('./routes/extensionroute');
const dotenv = require('dotenv');
const { backendURL } = require('./config/sanitization');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Serve static files
app.use("/uploads", express.static("uploads"));

// ✅ CORS Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://connect-in-iota.vercel.app',
  'https://connect-204jzoomo-faisals-projects-b859655a.vercel.app',
  'https://0918-103-232-142-179.ngrok-free.app', // ← your current ngrok frontend URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    return callback(new Error(`❌ Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// 🌍 Log the origin of requests (for debugging)
app.use((req, res, next) => {
  console.log('🌍 Request Origin:', req.get('Origin'));
  next();
});

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/admin', adminApiRoutes);
app.use('/api/user', userroutes);
app.use('/api/extension', extensionroute);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
