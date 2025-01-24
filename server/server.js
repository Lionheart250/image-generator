// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
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
const db = new sqlite3.Database('./anime_ai.db', (err) => {
    if (err) {
        console.error('Database opening error: ', err);
    }
});

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            token TEXT,
            expires_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
});

// Middleware
app.use(cors({ origin: 'http://localhost:3001' })); // Allow requests from frontend
app.use(bodyParser.json());

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret';

// Middleware to verify and refresh tokens
const authenticateTokenWithAutoRefresh = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                // Token has expired, attempt to refresh it
                const refreshToken = req.headers['x-refresh-token'];
                if (!refreshToken) return res.status(401).json({ error: 'Unauthorized' });

                jwt.verify(refreshToken, REFRESH_SECRET, (err, decoded) => {
                    if (err) return res.status(403).json({ error: 'Forbidden' });

                    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '15m' });
                    res.setHeader('x-access-token', newAccessToken);
                    req.user = { id: decoded.userId };
                    next();
                });
            } else {
                console.error('Token verification error:', err);
                return res.status(401).json({ error: 'Invalid token' });
            }
        } else {
            req.user = { id: decoded.userId };
            console.log('Authenticated user:', req.user);
            next();
        }
    });
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
        db.run(
            `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    console.error('Error inserting user:', err);
                    return res.status(500).json({ error: 'User registration failed' });
                }
                res.status(201).json({ message: 'User registered successfully' });
            }
        );
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'User registration failed' });
    }
});

// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).json({ error: 'Login failed' });
            }
            if (!user) {
                return res.status(400).json({ error: 'Invalid email or password' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ error: 'Invalid email or password' });
            }

            const role = user.role; // Ensure the role is fetched from the user table
            const token = jwt.sign({ userId: user.id, username: user.username, role }, JWT_SECRET, { expiresIn: '7d' });
            const refreshToken = jwt.sign({ userId: user.id, username: user.username, role }, REFRESH_SECRET, { expiresIn: '30d' });

            // Save the refresh token in the database
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

            db.run(
                `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
                [user.id, refreshToken, expiresAt.toISOString()],
                (err) => {
                    if (err) {
                        console.error('Error saving refresh token:', err);
                        return res.status(500).json({ error: 'Login failed' });
                    }
                    res.json({ token, refreshToken, userId: user.id, message: 'Login successful' });
                }
            );
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh token
app.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    db.get(
        `SELECT * FROM refresh_tokens WHERE token = ?`,
        [refreshToken],
        (err, row) => {
            if (err) {
                console.error('Error fetching refresh token:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!row) {
                return res.status(403).json({ error: 'Invalid refresh token' });
            }

            const { user_id, expires_at } = row;

            // Check if token has expired
            if (new Date(expires_at) < new Date()) {
                db.run(
                    `DELETE FROM refresh_tokens WHERE token = ?`,
                    [refreshToken],
                    () => {}
                );
                return res.status(403).json({ error: 'Refresh token expired' });
            }

            // Issue new tokens
            jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid refresh token' });
                }

                const newToken = jwt.sign({ userId: user_id }, JWT_SECRET, { expiresIn: '1h' });
                const newRefreshToken = jwt.sign({ userId: user_id }, REFRESH_SECRET, { expiresIn: '7d' });

                // Save the new refresh token in the database
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                db.run(
                    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
                    [user_id, newRefreshToken, expiresAt.toISOString()],
                    (err) => {
                        if (err) {
                            console.error('Error storing new refresh token:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        // Delete the old token
                        db.run(
                            `DELETE FROM refresh_tokens WHERE token = ?`,
                            [refreshToken],
                            () => {}
                        );

                        res.json({ token: newToken, refreshToken: newRefreshToken });
                    }
                );
            });
        }
    );
});

// Logout route (optional for clearing refresh tokens)
app.post('/logout', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    db.run(
        `DELETE FROM refresh_tokens WHERE token = ?`,
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

app.post('/generate_image', authenticateTokenWithAutoRefresh, async (req, res) => {
    console.log('Request user:', req.user); // Debugging line to check user data

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

    const userId = req.user.id; // Extract userId from the authenticated user

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

    // Validate HiRes parameters only if enable_hr is true
    if (enable_hr) {
        if (typeof denoising_strength !== 'number' || denoising_strength < 0 || denoising_strength > 1) {
            return res.status(400).json({ error: 'Denoising strength must be a number between 0 and 1' });
        }
        if (upscale_factor < 1 || upscale_factor > 4) {
            return res.status(400).json({ error: 'Upscale factor must be between 1 and 4' });
        }
        if (hires_width < 256 || hires_width > 2048 || hires_height < 256 || hires_height > 2048) {
            return res.status(400).json({ error: 'HiRes Width and Height must be between 256 and 2048' });
        }
    }

    // Prepare payload for the image generation API
    const payload = {
        prompt,
        negative_prompt: negativePrompt,
        cfg_scale: cfgScale,
        steps,
        width,
        height,
        enable_hr, // Use the value from the request to determine HiRes fix
        denoising_strength: enable_hr ? denoising_strength : undefined, // Only include if HiRes is enabled
        upscale_factor: enable_hr ? upscale_factor : undefined, // Only include if HiRes is enabled
        hires_width: enable_hr ? hires_width : undefined, // Only include if HiRes is enabled
        hires_height: enable_hr ? hires_height : undefined // Only include if HiRes is enabled
    };

    try {
        const response = await axios.post('http://127.0.0.1:7860/sdapi/v1/txt2img', payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Check if the response contains an image
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

            if (!userId) {
                console.error('Missing user_id');
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Insert the image data into the database
            db.run(
                'INSERT INTO images (user_id, image_url, prompt, negative_prompt, cfg_scale, steps, width, height, enable_hires_fix, denoising_strength, upscale_factor, hires_width, hires_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                [
                    Number(userId), 
                    imageUrl, 
                    prompt || '', 
                    negativePrompt || '', 
                    Number(cfgScale), 
                    Number(steps), 
                    Number(width), 
                    Number(height),
                    enable_hr, // Save HiRes flag
                    enable_hr ? denoising_strength : null, // Save denoising strength if HiRes is enabled
                    enable_hr ? upscale_factor : null, // Save upscale factor if HiRes is enabled
                    enable_hr ? hires_width : null, // Save HiRes width if HiRes is enabled
                    enable_hr ? hires_height : null // Save HiRes height if HiRes is enabled
                ], 
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to save image' });
                    }
                    res.json({ image: imageUrl });
                }
            );
        } else {
            res.status(500).json({ error: 'No image generated' });
        }
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: `Failed to connect to API: ${error.message}` });
    }
});




// Fetch images from the database
app.get('/images', optionalAuthenticateToken, (req, res) => {
    db.all('SELECT * FROM images', [], (err, rows) => {
        if (err) {
            console.error('Error fetching images:', err);
            return res.status(500).json({ error: 'Failed to fetch images' });
        }
        res.json({ images: rows });
    });
});

app.get('/images/:id', authenticateTokenWithAutoRefresh, (req, res) => {
    const imageId = req.params.id;
    console.log(`Request for image ID: ${imageId}`); // Debug log for image ID

    db.get(
        `SELECT users.username, users.profile_picture, users.id AS user_id
         FROM images 
         JOIN users ON images.user_id = users.id 
         WHERE images.id = ?`,
        [imageId],
        (err, row) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "An unexpected error occurred." });
            }

            console.log(`Query result for image ID ${imageId}:`, row); // Log the result

            if (!row) {
                return res.status(404).json({ error: "Image not found" });
            }

            res.json(row);
        }
    );
});


// Like an Image
app.post('/add_like', (req, res) => {
    const { userId, imageId } = req.body;

    const insertQuery = `
        INSERT INTO likes (user_id, image_id)
        VALUES (?, ?);
    `;

    // Insert the like
    db.run(insertQuery, [userId, imageId], function (err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({ error: 'You have already liked this image' });
            }
            console.error('Error adding like:', err);
            return res.status(500).json({ error: 'Failed to add like' });
        }

        // Fetch the like details (optional, for confirmation or UI updates)
        const fetchQuery = `
            SELECT 
                likes.id AS like_id,
                likes.image_id,
                likes.created_at,
                users.username
            FROM 
                likes
            INNER JOIN 
                users
            ON 
                likes.user_id = users.id
            WHERE 
                likes.id = ?;
        `;

        db.get(fetchQuery, [this.lastID], (err, row) => {
            if (err) {
                console.error('Error fetching like details:', err);
                return res.status(500).json({ error: 'Failed to fetch like details' });
            }

            res.status(201).json(row); // Respond with the new like details
        });
    });
});


// Get Likes for an Image
app.get('/image_likes/:imageId', authenticateTokenWithAutoRefresh, (req, res) => {
    const { imageId } = req.params;

    db.all(
        `SELECT COUNT(*) as likeCount FROM likes WHERE image_id = ?`,
        [imageId],
        (err, rows) => {
            if (err) {
                console.error('Error fetching likes:', err);
                return res.status(500).json({ error: 'Failed to fetch likes' });
            }
            res.json({ imageId, likeCount: rows[0].likeCount });
        }
    );
});

// Fetch likes for a specific image
app.get('/fetch_likes', authenticateTokenWithAutoRefresh, (req, res) => {
    const imageId = req.query.id;
    const userId = req.user.id;

    db.get('SELECT COUNT(*) AS likes FROM likes WHERE image_id = ?', [imageId], (err, likesRow) => {
        if (err) {
            console.error('Error fetching likes:', err);
            return res.status(500).json({ error: 'Failed to fetch likes' });
        }

        db.get('SELECT 1 FROM likes WHERE image_id = ? AND user_id = ?', [imageId, userId], (err, userLikeRow) => {
            if (err) {
                console.error('Error checking user like:', err);
                return res.status(500).json({ error: 'Failed to check user like' });
            }

            res.json({
                likes: likesRow.likes,
                userHasLiked: !!userLikeRow,
            });
        });
    });
});

app.delete('/remove_like', (req, res) => {
    const { userId, imageId } = req.body;

    const deleteQuery = `
        DELETE FROM likes
        WHERE user_id = ? AND image_id = ?;
    `;

    // Execute the delete query
    db.run(deleteQuery, [userId, imageId], function (err) {
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
    db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, row) => {
        if (err) {
            console.error('Error checking image:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
            console.log('No image found with ID:', imageId);
            return res.status(404).json({ error: 'Image not found' });
        }

        // Image exists, proceed with deletion
        db.run('DELETE FROM images WHERE id = ?', [imageId], function(err) {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ error: 'Failed to delete image' });
            }

            console.log('Image deleted successfully:', imageId);
            res.status(200).json({ message: 'Image deleted successfully' });
        });
    });
});

// --- Comment Routes ---

// Add Comment to an Image
app.post('/add_comment', (req, res) => {
    const { userId, imageId, comment } = req.body;

    const insertQuery = `
        INSERT INTO comments (user_id, image_id, comment)
        VALUES (?, ?, ?);
    `;

    db.run(insertQuery, [userId, imageId, comment], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to add comment' });
        }

        const fetchQuery = `
            SELECT 
                comments.id AS comment_id,
                comments.comment,
                comments.created_at,
                users.username
            FROM 
                comments
            INNER JOIN 
                users
            ON 
                comments.user_id = users.id
            WHERE 
                comments.id = ?;
        `;

        db.get(fetchQuery, [this.lastID], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to fetch added comment' });
            }

            res.json(row); // Send the new comment (including username) to the client
        });
    });
});


// Fetch comments for a specific image
app.get('/fetch_comments', authenticateTokenWithAutoRefresh, (req, res) => {
    const imageId = req.query.id;

    const query = `
        SELECT 
            comments.id,
            comments.image_id,
            comments.user_id,
            comments.comment,
            comments.created_at,
            users.profile_picture,
            users.username
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.image_id = ?`;

    db.all(query, [imageId], (err, rows) => {
        if (err) {
            console.error('Error fetching comments:', err);
            return res.status(500).json({ error: 'Failed to fetch comments' });
        }

        res.json({ comments: rows });
    });
});


// --- Favorites Routes (Optional) ---

// Add an Image to Favorites
app.post('/add_favorite', authenticateTokenWithAutoRefresh, (req, res) => {
    const { imageId } = req.body;
    const userId = req.user.userId;

    db.run(
        `INSERT INTO favorites (user_id, image_id) VALUES (?, ?)`,
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
            db.get(
                'SELECT filepath FROM profile_pictures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.filepath : null);
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
        db.run(
            'INSERT INTO profile_pictures (user_id, filename, filepath) VALUES (?, ?, ?)',
            [userId, filename, filepath],
            function(err) {
                if (err) {
                    console.error('Error saving to profile_pictures:', err);
                    return res.status(500).json({ error: 'Failed to save profile picture' });
                }

                // Update users table
                db.run(
                    'UPDATE users SET profile_picture = ? WHERE id = ?',
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
        WHERE u.id = ?
        ORDER BY pp.created_at DESC
        LIMIT 1
    `;
    
    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
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
        WHERE id = ?
    `;

    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Failed to fetch user profile' });
        }
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
        SET username = ?, bio = ?
        WHERE id = ?
    `;

    db.run(query, [username, bio, userId], function (err) {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        res.json({ message: 'Profile updated successfully' });
    });
});

app.get('/user_images/:userId', authenticateTokenWithAutoRefresh, (req, res) => {
    console.log('Request params:', req.params); // Debug log
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.all(
        `SELECT images.*, users.username, users.profile_picture 
         FROM images 
         JOIN users ON images.user_id = users.id 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('Error fetching user images:', err);
                return res.status(500).json({ error: 'Failed to fetch user images' });
            }
            console.log('Found images for user:', rows?.length); // Debug log
            res.json({ images: rows });
        }
    );
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

