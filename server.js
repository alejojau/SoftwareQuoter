require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/build')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Placeholder API endpoints for quoter functionality
app.post('/api/quote/estimate', (req, res) => {
  // TODO: Implement quote estimation logic
  res.json({ message: 'Quote estimation endpoint - to be implemented' });
});

app.get('/api/quote/:id', (req, res) => {
  // TODO: Implement get quote by ID
  res.json({ message: 'Get quote endpoint - to be implemented' });
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 SoftwareQuoter server running on http://localhost:${PORT}`);
});
