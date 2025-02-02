// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg'); // Add PostgreSQL import
const axios = require('axios');
const multer = require('multer'); // Add multer for file uploads
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/profile_pictures', express.static(path.join(__dirname, 'profile_pictures')));

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'profile_pictures');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Database setup
console.log('Environment variables:', {
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Add better error handling
pool.on('error', (err) => {
    console.error('Database connection error:', err);
    if (err.code === 'ECONNREFUSED') {
        console.error('Ensure PostgreSQL is running:');
        console.error('brew services start postgresql@14');
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err);
        console.error('Connection details:', {
            user: 'jack',
            host: 'localhost',
            database: 'anime_ai_db',
            port: 5432
        });
    } else {
        console.log('Connected to PostgreSQL database');
    }
});

// Reset the sequence for refresh_tokens
pool.query("SELECT setval('refresh_tokens_id_seq', (SELECT MAX(id) FROM refresh_tokens));");

// Middleware

app.use(cors({
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Middleware to verify and refresh tokens
const authenticateTokenWithAutoRefresh = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Auth middleware decoded token:', decoded);
        
        req.user = {
            userId: decoded.userId,  // Match the token field name
            username: decoded.username,
            role: decoded.role
        };
        
        console.log('Set req.user:', req.user);
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        res.status(403).json({ error: 'Invalid token' });
    }
};

// Middleware to optionally verify JWT
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next(); // Skip authentication if no token is provided

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(); // Skip authentication if token is invalid
        req.user = user;
        next();
    });
};

// Add after middleware setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './profile_pictures')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        cb(null, `profile_${req.user.userId}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image file'));
        }
    }
}).single('image'); // Changed from 'profile_picture' to 'image'

// --- User Routes ---

// Register User
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Reset sequence if needed
        await client.query(`
            SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0))
        `);

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await client.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, email]
        );

        await client.query('COMMIT');
        res.json({ id: result.rows[0].id });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        
        if (error.constraint === 'users_username_key') {
            res.status(400).json({ error: 'Username already exists' });
        } else if (error.constraint === 'users_email_key') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Registration failed' });
        }
    } finally {
        client.release();
    }
});

// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        console.log('User found:', result.rows[0] ? 'yes' : 'no');
        
        const user = result.rows[0];
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        console.log('JWT_SECRET exists:', !!JWT_SECRET);
        console.log('REFRESH_SECRET exists:', !!REFRESH_SECRET);

        const role = user.role;
        const token = jwt.sign({ userId: user.id, username: user.username, role }, JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = jwt.sign({ userId: user.id, username: user.username, role }, REFRESH_SECRET, { expiresIn: '30d' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Delete existing refresh tokens for user
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

        // Insert new refresh token
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.json({ token, refreshToken, userId: user.id, message: 'Login successful' });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh token
app.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const result = await pool.query(
            'SELECT rt.*, u.username, u.role FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = $1',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }

        const { user_id, expires_at, username, role } = result.rows[0];

        // Check if token has expired
        if (new Date(expires_at) < new Date()) {
            await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
            return res.status(403).json({ error: 'Refresh token expired' });
        }

        // Generate new tokens
        const newToken = jwt.sign(
            { userId: user_id, username, role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const newRefreshToken = jwt.sign(
            { userId: user_id, username, role },
            process.env.REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Update refresh token in database
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await pool.query(
            'UPDATE refresh_tokens SET token = $1, expires_at = $2 WHERE user_id = $3 AND token = $4',
            [newRefreshToken, newExpiresAt, user_id, refreshToken]
        );

        res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Refresh token route
app.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
            [refreshToken]
        );
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }
        // ...existing token generation code...
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout route (optional for clearing refresh tokens)
app.post('/logout', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    pool.query(
        `DELETE FROM refresh_tokens WHERE token = $1`,
        [refreshToken],
        (err) => {
            if (err) {
                console.error('Error deleting refresh token:', err);
                return res.status(500).json({ error: 'Failed to log out' });
            }
            res.json({ message: 'Logged out successfully' });
        }
    );
});

// --- Image Routes ---

// Fetch all images
app.get('/images', optionalAuthenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT i.*, u.username, u.profile_picture 
            FROM images i
            LEFT JOIN users u ON i.user_id = u.id 
            ORDER BY i.created_at DESC`
        );
        res.json({ images: result.rows });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Fetch single image
app.get('/images/:id', authenticateTokenWithAutoRefresh, async (req, res) => {
    const imageId = parseInt(req.params.id);
    
    if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
    }

    try {
        const result = await pool.query(`
            SELECT 
                i.*,
                u.username, 
                u.profile_picture, 
                u.id AS user_id
            FROM images i
            JOIN users u ON i.user_id = u.id 
            WHERE i.id = $1
        `, [imageId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Image not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

const FORGE_URL = 'http://127.0.0.1:7860';

// Generate image
app.post('/generate_image', authenticateTokenWithAutoRefresh, async (req, res) => {
    const { prompt, negativePrompt, width, height, distilled_cfg_scale, steps, sampler_name } = req.body;
    const userId = req.user.userId;

    try {
        // Generate image with ForgeUI
        const response = await axios.post(`${FORGE_URL}/sdapi/v1/txt2img`, {
            prompt: prompt,
            negative_prompt: negativePrompt,
            width: width,
            height: height,
            cfg_scale: 1,
            distilled_cfg_scale: distilled_cfg_scale || 3.5,
            steps: steps || 20,
            sampler_name: "Euler",
            scheduler: "Simple",
            batch_size: 1,
            seed: -1
        });

        if (response.data?.images?.[0]) {
            const imageUrl = `data:image/png;base64,${response.data.images[0]}`;
            const result = await pool.query(
                `INSERT INTO images (user_id, image_url, prompt, negative_prompt, steps, width, height) 
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [userId, imageUrl, prompt, negativePrompt, steps, width, height]
            );

            res.json({ image: response.data.images[0], imageId: result.rows[0].id });
        }
    } catch (error) {
        console.error('ForgeUI Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

// Like an Image
app.post('/add_like', authenticateTokenWithAutoRefresh, async (req, res) => {
    const { userId, imageId } = req.body;

    try {
        await pool.query(
            'INSERT INTO likes (user_id, image_id) VALUES ($1, $2)',
            [userId, imageId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add like' });
    }
});

// Like image
app.post('/like_image', authenticateTokenWithAutoRefresh, async (req, res) => {
    const { imageId } = req.body;
    const userId = req.user.userId;
    try {
        await pool.query(
            'INSERT INTO likes (user_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, imageId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Failed to like image' });
    }
});

// Get Likes for an Image
app.get('/image_likes/:imageId', authenticateTokenWithAutoRefresh, (req, res) => {
    const { imageId } = req.params;

    pool.query(
        `SELECT COUNT(*) as likeCount FROM likes WHERE image_id = $1`,
        [imageId],
        (err, result) => {
            if (err) {
                console.error('Error fetching likes:', err);
                return res.status(500).json({ error: 'Failed to fetch likes' });
            }
            res.json({ imageId, likeCount: result.rows[0].likecount });
        }
    );
});

// Fetch likes for a specific image
app.get('/fetch_likes', authenticateTokenWithAutoRefresh, async (req, res) => {
    const imageId = req.query.id;
    const userId = req.user.id;

    try {
        const likesCount = await pool.query(
            'SELECT COUNT(*) FROM likes WHERE image_id = $1',
            [imageId]
        );
        const userLiked = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM likes WHERE image_id = $1 AND user_id = $2)',
            [imageId, userId]
        );
        res.json({
            likes: parseInt(likesCount.rows[0].count),
            userHasLiked: userLiked.rows[0].exists
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
});

app.delete('/remove_like', (req, res) => {
    const { userId, imageId } = req.body;

    const deleteQuery = `
        DELETE FROM likes
        WHERE user_id = $1 AND image_id = $2;
    `;

    // Execute the delete query
    pool.query(deleteQuery, [userId, imageId], function (err) {
        if (err) {
            console.error('Error removing like:', err);
            return res.status(500).json({ error: 'Failed to remove like' });
        }

        // Check if any rows were affected
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Like not found' }); // No like to remove
        }

        res.status(200).json({ message: 'Like removed successfully' }); // Successful deletion
    });
});

// Single endpoint for handling likes
app.route('/likes/:imageId')
    .get(authenticateTokenWithAutoRefresh, async (req, res) => {
        const imageId = req.params.imageId;
        const userId = req.user.userId;

        try {
            const result = await pool.query(`
                SELECT 
                    COUNT(*) as total_likes,
                    EXISTS(
                        SELECT 1 FROM likes 
                        WHERE image_id = $1 AND user_id = $2
                    ) as user_liked
                FROM likes 
                WHERE image_id = $1
            `, [imageId, userId]);

            res.json({
                count: parseInt(result.rows[0].total_likes),
                userHasLiked: result.rows[0].user_liked
            });
        } catch (error) {
            console.error('Error handling likes:', error);
            res.status(500).json({ error: 'Failed to process likes request' });
        }
    })
    .post(authenticateTokenWithAutoRefresh, async (req, res) => {
        const imageId = req.params.imageId;
        const userId = req.user.userId;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(`
                INSERT INTO likes (user_id, image_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, image_id) DO NOTHING
            `, [userId, imageId]);

            const likeCount = await client.query(`
                SELECT COUNT(*) as count
                FROM likes
                WHERE image_id = $1
            `, [imageId]);

            await client.query('COMMIT');
            
            res.json({
                success: true,
                count: parseInt(likeCount.rows[0].count)
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Like error:', error);
            res.status(500).json({ error: 'Failed to like image' });
        } finally {
            client.release();
        }
    })
    .delete(authenticateTokenWithAutoRefresh, async (req, res) => {
        const imageId = req.params.imageId;
        const userId = req.user.userId;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(`
                DELETE FROM likes
                WHERE user_id = $1 AND image_id = $2
            `, [userId, imageId]);

            const likeCount = await client.query(`
                SELECT COUNT(*) as count
                FROM likes
                WHERE image_id = $1
            `, [imageId]);

            await client.query('COMMIT');
            
            res.json({
                success: true,
                count: parseInt(likeCount.rows[0].count)
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Unlike error:', error);
            res.status(500).json({ error: 'Failed to unlike image' });
        } finally {
            client.release();
        }
    });


// Delete image
app.delete('/images/:id', authenticateTokenWithAutoRefresh, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM images WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Image not found or unauthorized' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// --- Comment Routes ---

// Add Comment to an Image
app.post('/add_comment', authenticateTokenWithAutoRefresh, async (req, res) => {
    const { userId, imageId, comment } = req.body;

    try {
        await pool.query(
            'INSERT INTO comments (user_id, image_id, comment) VALUES ($1, $2, $3)',
            [userId, imageId, comment]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Add comment
app.post('/add_comment', authenticateTokenWithAutoRefresh, async (req, res) => {
    const { imageId, comment } = req.body;
    const userId = req.user.userId;
    try {
        await pool.query(
            'INSERT INTO comments (user_id, image_id, comment) VALUES ($1, $2, $3)',
            [userId, imageId, comment]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Comment add error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Fetch comments for a specific image
app.get('/fetch_comments', authenticateTokenWithAutoRefresh, async (req, res) => {
    const imageId = req.query.id;
    const userId = req.user.userId;
    console.log('Fetching comments for image:', imageId);

    try {
        const result = await pool.query(`
            SELECT 
                c.*,
                u.username,
                u.profile_picture,
                COUNT(DISTINCT l.id) as like_count,
                EXISTS (
                    SELECT 1 
                    FROM likes l2 
                    WHERE l2.comment_id = c.id 
                    AND l2.user_id = $2
                ) as user_has_liked
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            LEFT JOIN likes l ON l.comment_id = c.id
            WHERE c.image_id = $1 
            GROUP BY c.id, u.username, u.profile_picture
            ORDER BY c.created_at DESC`,
            [imageId, userId]
        );
        
        console.log(`Found ${result.rows.length} comments with likes`);
        res.json({ 
            comments: result.rows.map(comment => ({
                ...comment,
                like_count: parseInt(comment.like_count),
                user_has_liked: comment.user_has_liked
            }))
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

app.route('/comment_likes/:commentId')
    .get(authenticateTokenWithAutoRefresh, async (req, res) => {
        const { commentId } = req.params;
        const userId = req.user.userId;
        
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as count,
                EXISTS(SELECT 1 FROM likes WHERE comment_id = $1 AND user_id = $2) as user_liked
                FROM likes WHERE comment_id = $1`, 
                [commentId, userId]
            );
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching comment likes:', error);
            res.status(500).json({ error: 'Failed to fetch comment likes' });
        }
    })
    .post(authenticateTokenWithAutoRefresh, async (req, res) => {
        const { commentId } = req.params;
        const userId = req.user.userId;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                'INSERT INTO likes (user_id, comment_id, image_id) VALUES ($1, $2, NULL)',
                [userId, commentId]
            );
            
            const result = await client.query(
                'SELECT COUNT(*) as count FROM likes WHERE comment_id = $1',
                [commentId]
            );
            
            await client.query('COMMIT');
            res.json({ 
                success: true, 
                count: parseInt(result.rows[0].count) 
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error liking comment:', error);
            res.status(500).json({ error: 'Failed to like comment' });
        } finally {
            client.release();
        }
    })
    .delete(authenticateTokenWithAutoRefresh, async (req, res) => {
        const { commentId } = req.params;
        const userId = req.user.userId;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                'DELETE FROM likes WHERE user_id = $1 AND comment_id = $2',
                [userId, commentId]
            );
            
            const result = await client.query(
                'SELECT COUNT(*) as count FROM likes WHERE comment_id = $1',
                [commentId]
            );
            
            await client.query('COMMIT');
            res.json({ 
                success: true, 
                count: parseInt(result.rows[0].count) 
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error unliking comment:', error);
            res.status(500).json({ error: 'Failed to unlike comment' });
        } finally {
            client.release();
        }
    });

// --- Favorites Routes (Optional) ---

// Add an Image to Favorites
app.post('/add_favorite', authenticateTokenWithAutoRefresh, (req, res) => {
    const { imageId } = req.body;
    const userId = req.user.userId;

    pool.query(
        `INSERT INTO favorites (user_id, image_id) VALUES ($1, $2)`,
        [userId, imageId],
        function (err) {
            if (err) {
                console.error('Error adding to favorites:', err);
                return res.status(400).json({ error: 'Failed to add to favorites' });
            }
            res.status(201).json({ message: 'Image added to favorites' });
        }
    );
});

// Upload Profile Picture
app.post('/upload_profile_picture', authenticateTokenWithAutoRefresh, async (req, res) => {
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(500).json({ error: 'Error uploading file' });
        }

        const userId = req.user.userId;
        const filepath = req.file.path;
        const filename = req.file.filename;

        try {
            await pool.query('BEGIN');

            // Delete old picture if exists
            const oldPicture = await pool.query(
                'SELECT filepath FROM profile_pictures WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [userId]
            );

            if (oldPicture.rows[0]?.filepath) {
                try {
                    await fs.promises.unlink(oldPicture.rows[0].filepath);
                } catch (err) {
                    console.log('No previous profile picture to delete');
                }
            }

            // Insert new picture
            await pool.query(
                'INSERT INTO profile_pictures (user_id, filename, filepath) VALUES ($1, $2, $3)',
                [userId, filename, filepath]
            );

            // Update user profile
            await pool.query(
                'UPDATE users SET profile_picture = $1 WHERE id = $2',
                [filepath, userId]
            );

            await pool.query('COMMIT');

            res.json({ 
                success: true,
                profilePicturePath: filepath 
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('Error handling profile picture:', error);
            res.status(500).json({ error: 'Failed to process profile picture' });
        }
    });
});

// Update profile picture retrieval endpoint
app.get('/profile_picture', authenticateTokenWithAutoRefresh, async (req, res) => {
    const userId = req.user.userId; // Changed from req.user.id to req.user.userId
    console.log('Fetching profile picture for user:', userId);
    
    try {
        const query = `
            SELECT 
                u.profile_picture,
                pp.filepath,
                u.username
            FROM users u
            LEFT JOIN profile_pictures pp 
                ON pp.user_id = u.id 
                AND pp.id = (
                    SELECT id 
                    FROM profile_pictures 
                    WHERE user_id = u.id 
                    ORDER BY created_at DESC 
                    LIMIT 1
                )
            WHERE u.id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        console.log('Query result:', result.rows[0]);
        
        if (!result.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const profilePicture = result.rows[0].filepath || 
                             result.rows[0].profile_picture || 
                             'default-avatar.png';
                             
        console.log('Selected profile picture:', profilePicture);
        
        res.json({ 
            profile_picture: profilePicture,
            username: result.rows[0].username 
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
    });
});

// Endpoint to get user profile
app.get('/user_profile/:id', authenticateTokenWithAutoRefresh, (req, res) => {
    const userId = req.params.id;
    console.log(`Fetching profile for user ID: ${userId}`);

    const query = `
        SELECT 
            u.username, 
            u.bio, 
            COALESCE(pp.filepath, u.profile_picture) as profile_picture
        FROM users u
        LEFT JOIN profile_pictures pp 
            ON pp.user_id = u.id 
            AND pp.id = (
                SELECT id 
                FROM profile_pictures 
                WHERE user_id = u.id 
                ORDER BY created_at DESC 
                LIMIT 1
            )
        WHERE u.id = $1
    `;

    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Failed to fetch user profile' });
        }

        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }

        const profilePicture = row.profile_picture || 'default-avatar.png';
        console.log('User profile data:', {
            userId,
            username: row.username,
            profile_picture: profilePicture
        });

        res.json({ 
            userId,
            username: row.username,
            bio: row.bio,
            profile_picture: profilePicture
        });
    });
});
// Endpoint to update user profile
app.post('/update_profile', authenticateTokenWithAutoRefresh, (req, res) => {
    const userId = req.user.id;
    const { username, bio } = req.body;

    const query = `
        UPDATE users
        SET username = $1, bio = $2
        WHERE id = $3
    `;

    pool.query(query, [username, bio, userId], function (err) {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        res.json({ message: 'Profile updated successfully' });
    });
});

// Update user profile
app.put('/update_profile', authenticateTokenWithAutoRefresh, async (req, res) => {
    const userId = req.user.userId;
    const { username, email } = req.body;
    try {
        await pool.query(
            'UPDATE users SET username = $1, email = $2 WHERE id = $3',
            [username, email, userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.get('/user_images/:userId', authenticateTokenWithAutoRefresh, (req, res) => {
    console.log('Request params:', req.params);
    console.log('Authenticated user:', req.user);
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Add detailed logging
    const query = `
        SELECT images.*, users.username, users.profile_picture 
        FROM images 
        JOIN users ON images.user_id = users.id 
        WHERE user_id = $1 
        ORDER BY created_at DESC
    `;
    
    console.log('Executing query with userId:', userId);

    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user images:', err);
            return res.status(500).json({ error: 'Failed to fetch user images' });
        }
        
        // Log each image's details
        result.rows.forEach(img => {
            console.log('Image:', {
                id: img.id,
                user_id: img.user_id,
                created_at: img.created_at
            });
        });
        
        console.log('Found images for user:', result.rows?.length);
        res.json({ images: result.rows });
    });
});

// Add new endpoints for bulk fetching likes and comments
app.get('/images/likes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT image_id, COUNT(*) as count 
            FROM likes 
            GROUP BY image_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/images/comments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT image_id, json_agg(comments.*) as comments 
            FROM comments 
            GROUP BY image_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});
