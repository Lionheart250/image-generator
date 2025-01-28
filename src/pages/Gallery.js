import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode'; // Ensure jwt-decode is installed
import './Gallery.css'; // Make sure this file exists with proper styles
import { useNavigate, useLocation } from 'react-router-dom';
import debounce from 'lodash.debounce'; // Ensure lodash.debounce is installed
import { ReactComponent as LikeIcon } from '../assets/icons/like.svg';
import { ReactComponent as CommentIcon } from '../assets/icons/comment.svg';
import { ReactComponent as ShareIcon } from '../assets/icons/share.svg';
import { ReactComponent as BookmarkIcon } from '../assets/icons/bookmark.svg';

const Gallery = () => {
    const [images, setImages] = useState([]);
    const [modalImage, setModalImage] = useState(null);
    const [activeImageId, setActiveImageId] = useState(null);
    const [likes, setLikes] = useState({});
    const [comments, setComments] = useState({});
    const [commentInput, setCommentInput] = useState('');
    const [userLikedImages, setUserLikedImages] = useState(new Set());
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState(''); // For storing the username from the token
    const [commentLikes, setCommentLikes] = useState({});
    const [modalOpen, setModalOpen] = useState(false); // Add modalOpen state
    const [imageUserDetails, setImageUserDetails] = useState({});
    const navigate = useNavigate();
    const location = useLocation();
    const gridRef = useRef(null);
    const [columns, setColumns] = useState(4);
    const [sortType, setSortType] = useState('newest');
    const [timeRange, setTimeRange] = useState('week');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Add debounce wrapper at top of component
    const debouncedOpenModal = useCallback(
        debounce((image) => {
            console.log('Opening modal for image ID:', image.id);
            setActiveImageId(image.id);
            setModalOpen(true);
            fetchImageDetails(image.id);
        }, 300),
        []
    );

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const response = await fetch('http://localhost:3000/images');
                const data = await response.json();
                setImages(data.images || []);
            } catch (error) {
                console.error('Error fetching images:', error);
            }
        };

        const checkAdminStatus = () => {
            const token = localStorage.getItem('token');
            if (token) {
                const decoded = jwtDecode(token);
                setIsAdmin(decoded.role === 'admin');
                setUsername(decoded.username); // Extract the username from the token
            }
        };

        fetchImages();
        checkAdminStatus();
    }, []);

    // Modify useEffect that handles URL parameters
    useEffect(() => {
        const imageId = new URLSearchParams(location.search).get('id');
        if (imageId) {
            const image = images.find(img => img.id === parseInt(imageId));
            if (image && !modalOpen) {  // Add modalOpen check
                debouncedOpenModal(image);
            }
        }
    }, [location, images, modalOpen]); // Add proper dependencies

    const fetchImageDetails = async (imageId) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            // Fetch user details for image
            const imageDetailsResponse = await fetch(`http://localhost:3000/images/${imageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (imageDetailsResponse.ok) {
                const imageData = await imageDetailsResponse.json();
                setImageUserDetails(prev => ({
                    ...prev,
                    [imageId]: imageData
                }));
            }

            // Existing likes/comments fetch
            const likeResponse = await fetch(`http://localhost:3000/fetch_likes?id=${imageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (likeResponse.ok) {
                const likeData = await likeResponse.json();
                setLikes((prev) => ({ ...prev, [imageId]: likeData.likes || 0 }));
                if (likeData.userHasLiked) {
                    setUserLikedImages((prev) => new Set(prev).add(imageId));
                }
            }

            const commentResponse = await fetch(`http://localhost:3000/fetch_comments?id=${imageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}` 
                }
            });
            if (commentResponse.ok) {
                const commentData = await commentResponse.json();
                // Comments should now include profile_picture from backend
                setComments((prev) => ({ ...prev, [imageId]: commentData.comments || [] }));
            }
        } catch (error) {
            console.error('Error fetching image details:', error);
        }
    };

    const handleLike = async () => {
        const token = localStorage.getItem('token');
        if (!token) return; // Exit if no token is found
    
        const userId = jwtDecode(token).userId; // Decode the token to get userId
        const hasLiked = userLikedImages.has(activeImageId); // Check if the user has already liked this image
    
        try {
            const response = hasLiked 
                ? await fetch('http://localhost:3000/remove_like', { // Send request to remove like
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        userId, // Include userId
                        imageId: activeImageId, // Current imageId
                    }),
                })
                : await fetch('http://localhost:3000/add_like', { // Send request to add like
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        userId, // Include userId
                        imageId: activeImageId, // Current imageId
                    }),
                });
    
            if (response.ok) {
                if (hasLiked) {
                    // Remove like
                    setLikes((prev) => ({
                        ...prev,
                        [activeImageId]: Math.max((prev[activeImageId] || 0) - 1, 0),
                    }));
                    setUserLikedImages((prev) => {
                        const updatedLikes = new Set(prev);
                        updatedLikes.delete(activeImageId);
                        return updatedLikes;
                    });
                } else {
                    // Add like
                    setLikes((prev) => ({
                        ...prev,
                        [activeImageId]: (prev[activeImageId] || 0) + 1,
                    }));
                    setUserLikedImages((prev) => new Set(prev).add(activeImageId));
                }
            } else {
                const errorData = await response.json();
                console.error('Error toggling like:', errorData);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    // Update comment state when adding new comment
    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) return;
    
        try {
            const decoded = jwtDecode(token);
            const userId = decoded.userId;
    
            // Post the new comment
            const response = await fetch('http://localhost:3000/add_comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userId, imageId: activeImageId, comment: commentInput }),
            });
    
            if (response.ok) {
                // After adding the comment, fetch all comments again
                const commentsResponse = await fetch(`http://localhost:3000/fetch_comments?id=${activeImageId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
    
                if (commentsResponse.ok) {
                    const commentsData = await commentsResponse.json();
                    // Update comments state with the latest comments
                    setComments((prev) => ({
                        ...prev,
                        [activeImageId]: commentsData.comments, // Use the fetched comments
                    }));
                    setCommentInput(''); // Clear the comment input
                } else {
                    console.error('Error fetching comments:', await commentsResponse.json());
                }
            } else {
                console.error('Error adding comment:', await response.json());
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleDeleteImage = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            return;
        }
    
        console.log("Attempting to delete image:", activeImageId);
    
        try {
            const response = await fetch(`http://localhost:3000/delete_image/${activeImageId}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete image');
            }
    
            setImages(prev => prev.filter(image => image.id !== activeImageId));
            closeModal();
        } catch (error) {
            console.error('Error deleting image:', error);
            alert(error.message);
        }
    };

    const handleCommentLike = async (commentId) => {
        const token = localStorage.getItem('token');
        if (!token) return;
    
        try {
            const response = await fetch('http://localhost:3000/like_comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ commentId }),
            });
    
            if (response.ok) {
                setCommentLikes(prev => ({
                    ...prev,
                    [commentId]: (prev[commentId] || 0) + 1
                }));
            }
        } catch (error) {
            console.error('Error liking comment:', error);
        }
    };

    const openModal = (image) => {
        setModalImage(image.image_url);
        setActiveImageId(image.id);
        console.log('Opening modal for image ID:', image.id); // Debug log
        fetchImageDetails(image.id);
        navigate(`?id=${image.id}`, { replace: true });
    };

    const closeModal = () => {
        setModalImage(null);
        setActiveImageId(null);
        navigate('', { replace: true });
    };

    const navigateImage = (direction) => {
        const sortedImages = sortImages(images, sortType, timeRange);
        const currentIndex = sortedImages.findIndex(img => img.id === activeImageId);
        
        // Calculate current position in grid
        const currentColumn = currentIndex % 4;
        const currentRow = Math.floor(currentIndex / 4);
        
        let nextIndex;
        if (direction === 1) { // Next
            // If not at last column, move right
            if (currentColumn < 3) {
                nextIndex = currentIndex + 1;
            } 
            // If at last column, move to first column of next row
            else {
                nextIndex = (currentRow + 1) * 4;
            }
        } else { // Previous
            // If not at first column, move left
            if (currentColumn > 0) {
                nextIndex = currentIndex - 1;
            }
            // If at first column, move to last column of previous row
            else if (currentRow > 0) {
                nextIndex = (currentRow * 4) - 1;
            }
            // If at first column of first row, stay put
            else {
                return;
            }
        }
        
        // Check if next index exists
        if (nextIndex >= 0 && nextIndex < sortedImages.length) {
            const nextImage = sortedImages[nextIndex];
            setActiveImageId(nextImage.id);
            setModalImage(nextImage.image_url);
            fetchImageDetails(nextImage.id);
            navigate(`?id=${nextImage.id}`, { replace: true });
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!modalImage) return;

            switch(e.key) {
                case 'ArrowLeft':
                    navigateImage(-1);
                    break;
                case 'ArrowRight':
                    navigateImage(1);
                    break;
                case 'Escape':
                    closeModal();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalImage, activeImageId]);

    // Add this utility function
    const formatTimestamp = (timestamp) => {
        // Replace the space with "T" to convert to ISO 8601 format
        const formattedTimestamp = timestamp.replace(' ', 'T');
    
        const now = new Date();
        const commentDate = new Date(formattedTimestamp + 'Z'); // Adding 'Z' to indicate UTC
    
        // Handle invalid date
        if (isNaN(commentDate)) {
            return "Invalid date";
        }
    
        // Calculate the difference in milliseconds and convert to seconds
        const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
    
        // Check if the comment date is in the future
        if (diffInSeconds < 0) {
            return "In the future";
        }
    
        if (diffInSeconds < 60) {
            return `${diffInSeconds}s ago`;
        }
    
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        }
    
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        }
    
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) {
            return `${diffInDays}d ago`;
        }
    
        // Return formatted date string
        return commentDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };
        
    const handleUsernameClick = (user_id) => {
        navigate(`/profile/${user_id}`);
    };

    // Add formatDate function
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const sortImages = (images, sortType, timeRange) => {
        // First filter by time range if needed
        let filteredImages = [...images];
        
        if (sortType === 'trending') {
            const timeRanges = {
                'day': 24 * 60 * 60 * 1000,
                'week': 7 * 24 * 60 * 60 * 1000,
                'month': 30 * 24 * 60 * 60 * 1000,
                'year': 365 * 24 * 60 * 60 * 1000
            };
            const cutoff = new Date(Date.now() - timeRanges[timeRange]);
            filteredImages = filteredImages.filter(img => new Date(img.created_at) > cutoff);
        }
    
        // Filter by category if selected
        if (selectedCategory !== 'all') {
            filteredImages = filteredImages.filter(img => 
                img.categories?.includes(selectedCategory)
            );
        }
    
        // Sort based on type
        switch(sortType) {
            case 'newest':
                return filteredImages.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
            case 'mostLiked':
                return filteredImages.sort((a, b) => {
                    const aLikes = (likes[a.id] || 0);
                    const bLikes = (likes[b.id] || 0);
                    return bLikes - aLikes;
                });
            case 'mostCommented':
                return filteredImages.sort((a, b) => 
                    (comments[b.id]?.length || 0) - (comments[a.id]?.length || 0)
                );
                case 'trending':
                    return filteredImages.sort((a, b) => {
                        // Get likes and comments
                        const aLikes = (likes[a.id] || 0);
                        const bLikes = (likes[b.id] || 0);
                        const aComments = (comments[a.id]?.length || 0);
                        const bComments = (comments[b.id]?.length || 0);
                        
                        // Hours since post (minimum 1 hour)
                        const aHours = Math.max(1, (Date.now() - new Date(a.created_at)) / 3600000);
                        const bHours = Math.max(1, (Date.now() - new Date(b.created_at)) / 3600000);
                        
                        // Reddit-inspired algorithm with comments weighted 2x
                        const gravity = 1.8; // Higher = faster decay
                        const aScore = (aLikes + (aComments * 2)) / Math.pow(aHours, gravity);
                        const bScore = (bLikes + (bComments * 2)) / Math.pow(bHours, gravity);
                        
                        return bScore - aScore;
                    });
            default:
                return filteredImages;
        }
    };

    const createColumns = (images, numColumns) => {
        // Get sorted images using our sortImages function
        const sortedImages = sortImages(images, sortType, timeRange);
        
        // Initialize columns
        const cols = Array.from({ length: numColumns }, () => []);
        const colHeights = new Array(numColumns).fill(0);
        
        // Distribute in chronological order
        sortedImages.forEach((image, index) => {
            const targetCol = index % numColumns;
            const aspectRatio = image.width / image.height;
            const estimatedHeight = 250 / aspectRatio;
            
            cols[targetCol].push(image);
            colHeights[targetCol] += estimatedHeight;
        });
        
        return cols;
    };

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const columnWidth = 250; // Base column width
            const containerWidth = width - 200; // Account for sidebar and margins
            const calculatedColumns = Math.floor(containerWidth / columnWidth);
            setColumns(Math.min(4, Math.max(1, calculatedColumns)));
        };
    
        window.addEventListener('resize', handleResize);
        handleResize();
    
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const columnImages = createColumns(images, columns);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Get images first
                const imagesResponse = await fetch('http://localhost:3000/images');
                const imagesData = await imagesResponse.json();
                setImages(imagesData.images || []);

                // Then fetch details for all images
                const token = localStorage.getItem('token');
                if (!token) return;

                const promises = imagesData.images.map(async (image) => {
                    const [detailsRes, likesRes, commentsRes] = await Promise.all([
                        fetch(`http://localhost:3000/images/${image.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }),
                        fetch(`http://localhost:3000/fetch_likes?id=${image.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }),
                        fetch(`http://localhost:3000/fetch_comments?id=${image.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                    ]);

                    const [details, likes, comments] = await Promise.all([
                        detailsRes.json(),
                        likesRes.json(),
                        commentsRes.json()
                    ]);

                    return {
                        id: image.id,
                        details,
                        likes,
                        comments
                    };
                });

                const results = await Promise.all(promises);

                // Update all states at once
                const newImageUserDetails = {};
                const newLikes = {};
                const newComments = {};
                const newUserLikedImages = new Set();

                results.forEach(({ id, details, likes, comments }) => {
                    newImageUserDetails[id] = details;
                    newLikes[id] = likes.likes || 0;
                    newComments[id] = comments.comments || [];
                    if (likes.userHasLiked) {
                        newUserLikedImages.add(id);
                    }
                });

                setImageUserDetails(newImageUserDetails);
                setLikes(newLikes);
                setComments(newComments);
                setUserLikedImages(newUserLikedImages);

            } catch (error) {
                console.error('Error fetching all data:', error);
            }
        };

        fetchAllData();
    }, []);

    return (
        <div className="gallery-container">
                <>
                    <div className="gallery-controls">
                        <select 
                            value={sortType} 
                            onChange={(e) => setSortType(e.target.value)}
                            className="gallery-sort"
                        >
                            <option value="newest">Newest</option>
                            <option value="mostLiked">Most Liked</option>
                            <option value="mostCommented">Most Commented</option>
                            <option value="trending">Trending</option>
                        </select>

                        {sortType === 'trending' && (
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="gallery-time-range"
                            >
                                <option value="day">24 Hours</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                                <option value="year">This Year</option>
                            </select>
                        )}

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="gallery-category"
                        >
                            <option value="all">All Categories</option>
                            <option value="portraits">Portraits</option>
                            <option value="landscapes">Landscapes</option>
                            <option value="abstract">Abstract</option>
                            <option value="anime">Anime</option>
                            {/* Add more categories as needed */}
                        </select>
                    </div>
                    <h2 className="gallery-heading"></h2>
                    <div className="gallery-grid" ref={gridRef}>
                        {columnImages.map((col, colIndex) => (
                            <div key={colIndex} className="gallery-column">
                                {col.map((image) => (
                                    <div key={image.id} className="gallery-item" onClick={() => openModal(image)}>
                                        <img className="gallery-thumbnail" src={image.image_url} alt={image.prompt} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {modalImage && (
                        <div className="gallery-modal">
                            <div className="gallery-modal-content">
                                <div className="gallery-modal-main">
                                    <div className="gallery-modal-image-container">
                                        <button className="gallery-close-button" onClick={closeModal}>×</button>
                                        <button className="gallery-nav-button gallery-prev" onClick={() => navigateImage(-1)}>
                                            <span>‹</span>
                                        </button>
                                        <img className="gallery-modal-image" src={modalImage} alt="Enlarged" />
                                        {isAdmin && (
                                            <div className="gallery-delete-section">
                                                <button className="gallery-delete-button" onClick={handleDeleteImage}>
                                                    Delete Image
                                                </button>
                                            </div>
                                        )}
                                        <button className="gallery-nav-button gallery-next" onClick={() => navigateImage(1)}>
                                            <span>›</span>
                                        </button>
                                    </div>
                                    <div className="gallery-modal-info">
                                        <div className="gallery-user-info">
                                            <img 
                                                src={imageUserDetails[activeImageId]?.profile_picture || '/default-avatar.png'}
                                                alt="Profile"
                                                className="gallery-user-avatar"
                                                onClick={() => handleUsernameClick(imageUserDetails[activeImageId]?.user_id)}
                                            />
                                            <div className="gallery-user-details">
                                                <h4 onClick={() => handleUsernameClick(imageUserDetails[activeImageId]?.user_id)}>
                                                    {imageUserDetails[activeImageId]?.username}
                                                </h4>
                                                <span className="gallery-creation-date">
                                                    {formatDate(images.find(img => img.id === activeImageId)?.created_at)}
                                                </span>
                                            </div>
                                            <button className="gallery-follow-button">Follow</button>
                                        </div>
                                        <div className="gallery-modal-title">
                                            {images.find(img => img.id === activeImageId)?.prompt}
                                        </div>
                                        <div className="gallery-interaction-buttons">
                                            <button onClick={() => handleLike(activeImageId)} className="gallery-action-btn">
                                                <LikeIcon className={userLikedImages.has(activeImageId) ? 'liked' : ''} />
                                                <span>{likes[activeImageId] || 0}</span>
                                            </button>
                                            <button className="gallery-action-btn">
                                                <CommentIcon />
                                                <span>{comments[activeImageId]?.length || 0}</span>
                                            </button>
                                            <button className="gallery-action-btn">
                                                <ShareIcon />
                                            </button>
                                            <button className="gallery-action-btn">
                                                <BookmarkIcon />
                                            </button>
                                        </div>
                                        {/* Existing comments section */}
                                        <div className="gallery-comments-section">
                                            <h4 className="gallery-comments-heading">Comments</h4>
                                            <ul className="gallery-comments-list">
                                                {(comments[activeImageId] || []).map((comment) => (
                                                    <li key={`comment-${comment.id}-${comment.created_at}`} className="gallery-comment-item">
                                                        <div className="gallery-comment-avatar">
                                                            <img 
                                                                src={comment.profile_picture ? 
                                                                    `http://localhost:3000/${comment.profile_picture}` : 
                                                                    '/default-avatar.png'} 
                                                                alt={comment.username}
                                                                onError={(e) => e.target.src = '/default-avatar.png'}
                                                            />
                                                        </div>
                                                        <div className="gallery-comment-content">
                                                            <div className="gallery-comment-header">
                                                                <span 
                                                                    className="gallery-comment-username"
                                                                    onClick={() => handleUsernameClick(comment.user_id)}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                >
                                                                    {comment.username}
                                                                </span>
                                                                <span className="gallery-comment-time">
                                                                    {formatTimestamp(comment.created_at)}
                                                                </span>
                                                            </div>
                                                            <p className="gallery-comment-text">{comment.comment}</p>
                                                            <div className="gallery-comment-actions">
                                                                <button 
                                                                    className="gallery-comment-like-btn"
                                                                    onClick={() => handleCommentLike(comment.id)}
                                                                >
                                                                    ♥ {commentLikes[comment.id] || 0}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                            <form onSubmit={handleCommentSubmit} className="gallery-comment-form">
                                                <input
                                                    className="gallery-comment-input"
                                                    type="text"
                                                    value={commentInput}
                                                    onChange={(e) => setCommentInput(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    required
                                                />
                                                <button type="submit" className="gallery-comment-submit">Post</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
        </div>
    );
};

export default Gallery;