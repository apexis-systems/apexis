import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { sequelize } from './models/index.ts';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

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
