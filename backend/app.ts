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

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
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

// Test DB Connection and Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // Automatically create tables based on models (use migrations for production!)
        // await sequelize.sync(); 

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
