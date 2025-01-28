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
    user: 'jack',
    host: 'localhost',
    database: 'anime_ai_db',
    password: process.env.DB_PASSWORD,
    port: 5432
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
app.use(cors({ origin: process.env.CORS_ORIGIN })); // Allow requests from frontend
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
const authenticateTokenWithAutoRefresh = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(403).json({ error: 'Invalid token' });
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
    destination: (req, file, cb) => {
        cb(null, 'profile_pictures/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// --- User Routes ---

// Register User
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, email]
        );
        res.json({ id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
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

// Generate image
app.post('/generate_image', authenticateTokenWithAutoRefresh, async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
    }

    const { 
        prompt, 
        negativePrompt, 
        cfgScale, 
        steps, 
        width, 
        height, 
        enable_hr, 
        denoising_strength, 
        upscale_factor, 
        hires_width, 
        hires_height 
    } = req.body;

    // Validate required fields
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    if (cfgScale < 1 || cfgScale > 30) {
        return res.status(400).json({ error: 'cfgScale must be between 1 and 30' });
    }
    if (steps < 1 || steps > 100) {
        return res.status(400).json({ error: 'Steps must be between 1 and 100' });
    }
    if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        return res.status(400).json({ error: 'Width and Height must be between 256 and 2048' });
    }

    if (enable_hr) {
        if (typeof denoising_strength !== 'number' || denoising_strength < 0 || denoising_strength > 1) {
            return res.status(400).json({ error: 'Denoising strength must be a number between 0 and 1' });
        }
        if (upscale_factor < 1 || upscale_factor > 4) {
            return res.status(400).json({ error: 'Upscale factor must be between 1 and 4' });
        }
        if (hires_width < 256 || hires_width > 2048 || hires_height < 256 || hires_height > 2048) {
            return res.status(400).json({ error: 'HiRes dimensions must be between 256 and 2048' });
        }
    }

    const payload = {
        prompt,
        negative_prompt: negativePrompt,
        cfg_scale: cfgScale,
        steps,
        width,
        height,
        enable_hr,
        denoising_strength: enable_hr ? denoising_strength : undefined,
        upscale_factor: enable_hr ? upscale_factor : undefined,
        hires_width: enable_hr ? hires_width : undefined,
        hires_height: enable_hr ? hires_height : undefined
    };

    try {
        const response = await axios.post('http://127.0.0.1:7860/sdapi/v1/txt2img', payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.data && response.data.images && response.data.images[0]) {
            const imageUrl = `data:image/png;base64,${response.data.images[0]}`;

            console.log('Inserting with values:', {
                userId,
                promptLength: prompt?.length,
                negativePromptLength: negativePrompt?.length,
                cfgScale,
                steps,
                width,
                height,
                enable_hr,
                denoising_strength,
                upscale_factor,
                hires_width,
                hires_height
            });

            const query = `
                INSERT INTO images (
                    user_id, image_url, prompt, negative_prompt, 
                    cfg_scale, steps, width, height, 
                    enable_hires_fix, denoising_strength, 
                    upscale_factor, hires_width, hires_height,
                    categories
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id`;

            await pool.query(query, [
                parseInt(userId) || null,  // Ensure integer or null
                imageUrl,
                prompt || '',
                negativePrompt || '',
                parseInt(cfgScale) || null,
                parseInt(steps) || null,
                parseInt(width) || null,
                parseInt(height) || null,
                enable_hr ? 1 : 0,
                parseFloat(denoising_strength) || null,
                parseInt(upscale_factor) || null,
                parseInt(hires_width) || null,
                parseInt(hires_height) || null,
                []
            ]);

            res.json({ image: imageUrl });
        } else {
            res.status(500).json({ error: 'No image generated' });
        }
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: `Failed to generate image: ${error.message}` });
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


// Delete Image
app.delete('/delete_image/:imageId', authenticateTokenWithAutoRefresh, (req, res) => {
    const imageId = req.params.imageId;
    console.log('Delete request for image:', imageId);

    // First verify image exists
    pool.query('SELECT * FROM images WHERE id = $1', [imageId], (err, result) => {
        if (err) {
            console.error('Error checking image:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const row = result.rows[0];

        if (!row) {
            console.log('No image found with ID:', imageId);
            return res.status(404).json({ error: 'Image not found' });
        }

        // Image exists, proceed with deletion
        pool.query('DELETE FROM images WHERE id = $1', [imageId], function(err) {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ error: 'Failed to delete image' });
            }

            console.log('Image deleted successfully:', imageId);
            res.status(200).json({ message: 'Image deleted successfully' });
        });
    });
});

// Delete image
app.delete('/images/:id', authenticateTokenWithAutoRefresh, async (req, res) => {
    const imageId = parseInt(req.params.id);
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            'DELETE FROM images WHERE id = $1 AND user_id = $2 RETURNING *',
            [imageId, userId]
        );
        if (result.rows.length === 0) {
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

    try {
        const result = await pool.query(
            'SELECT c.*, u.username, u.profile_picture FROM comments c JOIN users u ON c.user_id = u.id WHERE c.image_id = $1',
            [imageId]
        );
        res.json({ comments: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Fetch comments
app.get('/fetch_comments', async (req, res) => {
    const { id } = req.query;
    try {
        const result = await pool.query(`
            SELECT c.*, u.username, u.profile_picture 
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.image_id = $1 
            ORDER BY c.created_at DESC`,
            [id]
        );
        res.json({ comments: result.rows });
    } catch (error) {
        console.error('Comment fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
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
app.post('/upload_profile_picture', authenticateTokenWithAutoRefresh, upload.single('profile_picture'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const filepath = req.file.path;
    const filename = req.file.filename;

    try {
        // Get old picture info
        const oldPicture = await new Promise((resolve, reject) => {
            pool.query(
                'SELECT filepath FROM profile_pictures WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [userId],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result.rows[0] ? result.rows[0].filepath : null);
                }
            );
        });

        // Delete old file if exists
        if (oldPicture) {
            try {
                await fs.promises.unlink(oldPicture);
            } catch (err) {
                console.log('No previous profile picture to delete');
            }
        }

        // Insert into profile_pictures table
        pool.query(
            'INSERT INTO profile_pictures (user_id, filename, filepath) VALUES ($1, $2, $3)',
            [userId, filename, filepath],
            function(err) {
                if (err) {
                    console.error('Error saving to profile_pictures:', err);
                    return res.status(500).json({ error: 'Failed to save profile picture' });
                }

                // Update users table
                pool.query(
                    'UPDATE users SET profile_picture = $1 WHERE id = $2',
                    [filepath, userId],
                    function(err) {
                        if (err) {
                            console.error('Error updating user profile:', err);
                            return res.status(500).json({ error: 'Failed to update profile' });
                        }
                        res.json({ 
                            message: 'Profile picture updated successfully',
                            profilePicturePath: filepath 
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error handling profile picture:', error);
        res.status(500).json({ error: 'Failed to process profile picture' });
    }
});

// Update profile picture retrieval endpoint
app.get('/profile_picture', authenticateTokenWithAutoRefresh, (req, res) => {
    const userId = req.user.id;
    console.log('Fetching profile picture for user:', userId);
    
    // Query both tables
    const query = `
        SELECT 
            u.profile_picture as user_picture,
            pp.filepath as pp_picture
        FROM users u
        LEFT JOIN profile_pictures pp ON pp.user_id = u.id
        WHERE u.id = $1
        ORDER BY pp.created_at DESC
        LIMIT 1
    `;
    
    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        const row = result.rows[0];

        console.log('Query result:', row);
        
        // Check both possible picture sources
        const profilePicture = row?.pp_picture || row?.user_picture || 'default-avatar.png';
        console.log('Selected profile picture:', profilePicture);
        
        res.json({ profile_picture: profilePicture });
    });
});

// Ensure static file serving is set up
app.use('/profile_pictures', express.static(path.join(__dirname, 'profile_pictures')));

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
    const userId = req.params.id; // Use the id parameter from the URL
    console.log(`Fetching profile for user ID: ${userId}`); // Debugging statement

    const query = `
        SELECT username, bio, profile_picture
        FROM users
        WHERE id = $1
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
        console.log('Query result:', row); // Debugging statement
        res.json({ userId, ...row }); // Include userId in the response
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
    console.log('Request params:', req.params); // Debug log
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    pool.query(
        `SELECT images.*, users.username, users.profile_picture 
         FROM images 
         JOIN users ON images.user_id = users.id 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId],
        (err, result) => {
            if (err) {
                console.error('Error fetching user images:', err);
                return res.status(500).json({ error: 'Failed to fetch user images' });
            }
            console.log('Found images for user:', result.rows?.length); // Debug log
            res.json({ images: result.rows });
        }
    );
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
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

