import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './src/db.js';
import api from './src/routes/api.js';
import ui from './src/routes/ui.js';
import cookie from './src/simple-cookie.js';
import expressEjsLayouts from 'express-ejs-layouts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await initDb();

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookie());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.cart = req.cart || {};
  next();
});

app.use('/api', api);
app.use(expressEjsLayouts);
app.set('layout', 'layout');
app.use('/', ui);

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Shop Node listening on http://localhost:${port}`);
});
