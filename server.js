'use strict';

require('dotenv').config();
require('express-async-errors');

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const path       = require('path');
const cron       = require('node-cron');

const logger         = require('./src/utils/logger');
const errorHandler   = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimit');

// ── Route Imports ────────────────────────────────────────────────────────────
const authRoutes         = require('./src/routes/auth');
const documentRoutes     = require('./src/routes/documents');
const taxReturnRoutes    = require('./src/routes/taxReturns');
const quickbooksRoutes   = require('./src/routes/quickbooks');
const aiAssistantRoutes  = require('./src/routes/aiAssistant');
const clientPortalRoutes = require('./src/routes/clientPortal');
const cpaReviewRoutes    = require('./src/routes/cpaReview');
const subscriptionRoutes = require('./src/routes/subscriptions');
const waitlistRoutes     = require('./src/routes/waitlist');
const dashboardRoutes    = require('./src/routes/dashboard');

// ── Scheduled Jobs ───────────────────────────────────────────────────────────
const { runReminderJob }  = require('./src/services/reminderService');
const { runCleanupJob }   = require('./src/services/cleanupService');

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Firm-ID'],
}));
app.use(mongoSanitize());
app.use(compression());

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
}

// ── Static Files (uploads) ───────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'TaxMind AI API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
const V1 = '/api/v1';

app.use(`${V1}/auth`,          authRoutes);
app.use(`${V1}/documents`,     documentRoutes);
app.use(`${V1}/tax-returns`,   taxReturnRoutes);
app.use(`${V1}/quickbooks`,    quickbooksRoutes);
app.use(`${V1}/ai-assistant`,  aiAssistantRoutes);
app.use(`${V1}/client-portal`, clientPortalRoutes);
app.use(`${V1}/cpa-review`,    cpaReviewRoutes);
app.use(`${V1}/subscriptions`, subscriptionRoutes);
app.use(`${V1}/waitlist`,      waitlistRoutes);
app.use(`${V1}/dashboard`,     dashboardRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database Connection & Server Start ───────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ MongoDB connected');

    const server = app.listen(PORT, () => {
      logger.info(`🚀 TaxMind AI API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // ── Cron Jobs ──────────────────────────────────────────────────────────
    // Daily 9am: send document request reminders to clients
    cron.schedule('0 9 * * *', runReminderJob);
    // Weekly Sunday 2am: clean up orphaned temp files
    cron.schedule('0 2 * * 0', runCleanupJob);

    logger.info('⏰ Scheduled jobs initialized');

    // ── Graceful Shutdown ─────────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
