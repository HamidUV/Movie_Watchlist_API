// index.js
import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'fallback_secret_key';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors()); // 👈 allow all origins
// Serve index.html by default when hitting root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// -----------------------------
// In-memory "database"
// -----------------------------
// Pre-defined users (no register route). movies array starts empty for each user.
const users = [
  { id: 1, username: 'Ashwanth', password: 'kok123', movies: [] },
  { id: 2, username: 'alice', password: '123', movies: [] }
];

// -----------------------------
// Helper: generate simple numeric id (per movie)
// -----------------------------
function generateId() {
  // Date.now() is fine for this student project
  return Date.now() + Math.floor(Math.random() * 1000);
}

// -----------------------------
// AUTH: Login (no register)
// POST /login
// Body: { username, password }
// Returns: { token }
// -----------------------------
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password required' });
  }

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ token });
});

// -----------------------------
// Middleware: authenticateToken
// Uses Authorization: Bearer <token>
// -----------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // handle missing header safely
  if (!token) return res.status(401).json({ message: 'Missing token' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });

    // attach the real user object (from in-memory users) to req.user
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;
    next();
  });
}



// app.get('/login',(req,res)=>{
//     res.sendFile('index.html');
// })

// -----------------------------
// MOVIES CRUD (protected routes)
// Movie structure:
// { id: 1, movietitle: "Inception", language: "English", watched: false }
// -----------------------------

// GET /movies?status=watched|unwatched
// Returns all movies for the authenticated user, optionally filtered
app.get('/movies', authenticateToken, (req, res) => {
  const { status } = req.query; // 'watched' or 'unwatched'
  let movies = req.user.movies || [];

  if (status === 'watched') {
    movies = movies.filter(m => m.watched === true);
  } else if (status === 'unwatched') {
    movies = movies.filter(m => m.watched === false);
  }

  res.json(movies);
});

// POST /movies
// Body: { movietitle, language, watched? }
// Create a new movie in the authenticated user's watchlist
app.post('/movies', authenticateToken, (req, res) => {
  const { movietitle, language, watched } = req.body || {};

  if (!movietitle || !language) {
    return res.status(400).json({ message: 'movietitle and language are required' });
  }

  const newMovie = {
    id: generateId(),
    movietitle,
    language,
    watched: watched === undefined ? false : !!watched
  };

  req.user.movies.push(newMovie);
  res.status(201).json(newMovie);
});

// GET /movies/:id
// Get a single movie by id (for the authenticated user)
app.get('/movies/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const movie = (req.user.movies || []).find(m => Number(m.id) === id);
  if (!movie) return res.status(404).json({ message: 'Movie not found' });
  res.json(movie);
});

// PUT /movies/:id
// Replace movie (requires movietitle, language, watched in body)
app.put('/movies/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const movie = (req.user.movies || []).find(m => Number(m.id) === id);
  if (!movie) return res.status(404).json({ message: 'Movie not found' });

  const { movietitle, language, watched } = req.body || {};
  if (movietitle === undefined || language === undefined || watched === undefined) {
    return res.status(400).json({ message: 'movietitle, language and watched are required for full update' });
  }

  movie.movietitle = movietitle;
  movie.language = language;
  movie.watched = !!watched;

  res.json(movie);
});

// PATCH /movies/:id
// Partial update - update any provided fields
app.patch('/movies/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const movie = (req.user.movies || []).find(m => Number(m.id) === id);
  if (!movie) return res.status(404).json({ message: 'Movie not found' });

  const { movietitle, language, watched } = req.body || {};
  if (movietitle !== undefined) movie.movietitle = movietitle;
  if (language !== undefined) movie.language = language;
  if (watched !== undefined) movie.watched = !!watched;

  res.json(movie);
});

// DELETE /movies/:id
// Remove movie from authenticated user's watchlist
app.delete('/movies/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const before = req.user.movies.length;
  req.user.movies = (req.user.movies || []).filter(m => Number(m.id) !== id);
  const after = req.user.movies.length;

  if (before === after) return res.status(404).json({ message: 'Movie not found' });
  res.status(204).send(); // no content
});

// -----------------------------
// Error handler for unknown routes
// -----------------------------
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`Movie Watchlist API running on http://localhost:${PORT}`);
});
