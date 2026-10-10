import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.use(errorHandler);
