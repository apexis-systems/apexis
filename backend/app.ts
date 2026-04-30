import "dotenv/config";
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sequelize } from './models/index.ts';
import onboardingRoutes from "./routes/onboardingRoutes.ts";
import authRoutes from "./routes/authRoutes.ts";
import projectRoutes from "./routes/projectRoutes.ts";
import userRoutes from "./routes/userRoutes.ts";
import fileRoutes from "./routes/fileRoutes.ts";
import folderRoutes from "./routes/folderRoutes.ts";
import superadminRoutes from "./routes/superadminRoutes.ts";
import commentRoutes from "./routes/commentRoutes.ts";
import reportRoutes from "./routes/reportRoutes.ts";
import snagRoutes from "./routes/snagRoutes.ts";
import rfiRoutes from "./routes/rfiRoutes.ts";
import manualRoutes from "./routes/manualRoutes.ts";
import activityRoutes from "./routes/activityRoutes.ts";
import organizationRoutes from "./routes/organizationRoutes.ts";
import chatRoutes from "./routes/chatRoutes.ts";
import notificationRoutes from "./routes/notificationRoutes.ts";
import { startCronJobs } from "./cron.ts";
import http from 'http';
import { initIO } from './socket.ts';
import qrAuthRoutes from "./routes/qrAuthRoutes.ts";
import analyticsRoutes from "./routes/analyticsRoutes.ts";
import subscriptionRoutes from "./routes/subscriptionRoutes.ts";
import systemRoutes from "./routes/systemRoutes.ts";
import searchRoutes from "./routes/searchRoutes.ts";

const app = express();
const httpServer = http.createServer(app);
const io = initIO(httpServer);

const PORT = process.env.PORT || 5001;

// Middleware
// Allow all origins
const corsOptions = {
    origin: true, // true means reflect request origin, allows all
    credentials: true, // allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

// Apply security and parsing middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ limit: '5000mb', extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
    res.send('Hello, backend is running!');
});

app.use("/api/onboarding", onboardingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrAuthRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/snags", snagRoutes);
app.use("/api/rfis", rfiRoutes);
app.use("/api/manuals", manualRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/search", searchRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error("Unhandled Error:", err);
    
    // Default to 500 Internal Server Error
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    
    res.status(status).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Test DB Connection and Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // Automatically create tables based on models (use migrations for production!)
        // await sequelize.sync(); 

        httpServer.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            startCronJobs();
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
