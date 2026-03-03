import "dotenv/config";
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
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
import manualRoutes from "./routes/manualRoutes.ts";
import { startCronJobs } from "./cron.ts";

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
// Allow all origins
const corsOptions = {
    origin: true, // true means reflect request origin, allows all
    credentials: true, // allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
    res.send('Hello, backend is running!');
});

app.use("/api/onboarding", onboardingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/snags", snagRoutes);
app.use("/api/manuals", manualRoutes);

// Test DB Connection and Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // Automatically create tables based on models (use migrations for production!)
        // await sequelize.sync(); 

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            startCronJobs();
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
