import React, { useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode'; // Ensure jwt-decode is installed
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import debounce from 'lodash.debounce';
import './Profile.css';

const Profile = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { profilePicture, setProfilePicture } = useProfile();
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [images, setImages] = useState([]);
    const [modalImage, setModalImage] = useState(null);
    const [activeImageId, setActiveImageId] = useState(null);
    const [likes, setLikes] = useState({});
    const [comments, setComments] = useState({});
    const [commentInput, setCommentInput] = useState('');
    const [userLikedImages, setUserLikedImages] = useState(new Set());
    const [commentLikes, setCommentLikes] = useState({});
    const [modalOpen, setModalOpen] = useState(false);
    const [tempUsername, setTempUsername] = useState('');
    const [tempBio, setTempBio] = useState('');
    const [tempProfilePicture, setTempProfilePicture] = useState(null);
    const [profilePictureFile, setProfilePictureFile] = useState(null);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [file, setFile] = useState(null);

    const debouncedOpenModal = useCallback(
        debounce((image) => {
            console.log('Opening modal for image ID:', image.id);
            setModalImage(image); // Add this line
            setActiveImageId(image.id);
            setModalOpen(true);
            fetchImageDetails(image.id);
        }, 300),
        []
    );

    // Add debug logs
    useEffect(() => {
        console.log('Modal state:', { modalOpen, modalImage, activeImageId });
    }, [modalOpen, modalImage, activeImageId]);

    useEffect(() => {
        // Fetch user bio and posts
        fetchUserProfile();
    }, [id]);

    useEffect(() => {
        // Initialize temp values when entering edit mode
        if (isEditing) {
            setTempUsername(username);
            setTempBio(bio);
            setTempProfilePicture(profilePicture);
            setProfilePictureFile(null);
            setMessage(''); // Clear message when opening modal
        }
    }, [isEditing]);

    useEffect(() => {
        const fetchUserImages = async () => {
            try {
                const token = localStorage.getItem('token');
                const loggedInUserId = localStorage.getItem('userId');
                
                // If viewing own profile use localStorage userId, otherwise use URL id
                const targetUserId = id === loggedInUserId ? loggedInUserId : id;
                
                console.log('Fetching images for user:', targetUserId);
                
                const response = await fetch(`http://localhost:3000/user_images/${targetUserId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Received images:', data);
                setImages(data.images || []);
            } catch (error) {
                console.error('Error fetching images:', error);
            }
        };

        fetchUserImages();
    }, [id]); // Add id as dependency to re-fetch when URL changes

    const fetchUserProfile = async () => {
        if (!id) return;
        
        try {
            setIsLoading(true);
            console.log('Starting profile fetch for ID:', id);
            const token = localStorage.getItem('token');
            
            // Fetch profile data first
            const response = await fetch(`http://localhost:3000/user_profile/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            console.log('Profile data received:', data);
            
            setUsername(data.username);
            setBio(data.bio || '');
            
            // Only update profile picture if it exists
            if (data.profile_picture && data.profile_picture !== 'default-avatar.png') {
                const baseUrl = 'http://localhost:3000';
                const picturePath = data.profile_picture.startsWith('/') 
                    ? data.profile_picture 
                    : `/${data.profile_picture}`;
                setProfilePicture(`${baseUrl}${picturePath}`);
            } else {
                // Keep existing profile picture if available, otherwise set default
                setProfilePicture(prev => prev || '/default-avatar.png');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchImageDetails = async (imageId) => {
        const token = localStorage.getItem('token');
        if (!token) return;
    
        try {
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

    const handleProfilePictureChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePictureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempProfilePicture(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const token = localStorage.getItem('token');
            // Assume "id" is the user's ID from props/useParams
            const response = await fetch(`http://localhost:3000/update_profile/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: tempUsername, bio: tempBio })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            // Update local state
            setUsername(data.data.username);
            setBio(data.data.bio || '');

            // (Optional) Upload new profile picture
            if (profilePictureFile) {
                const formData = new FormData();
                formData.append('image', profilePictureFile);

                const picResponse = await fetch('http://localhost:3000/upload_profile_picture', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const picData = await picResponse.json();
                if (!picResponse.ok) {
                    throw new Error(picData.error || 'Failed to upload profile picture');
                }
                setProfilePicture(`http://localhost:3000/${picData.profilePicturePath}`);
            }

            // Re-fetch to confirm DB changes
            await fetchUserProfile();
            setIsEditing(false);
            setMessage('Profile updated successfully');
        } catch (error) {
            console.error('Profile update error:', error);
            setMessage(error.message);
        } finally {
            setLoading(false);
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
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ commentId })
            });
    
            if (response.ok) {
                setCommentLikes(prev => ({
                    ...prev,
                    [commentId]: !prev[commentId]
                }));
            }
        } catch (error) {
            console.error('Error liking comment:', error);
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

    const closeModal = () => {
        setModalOpen(false);
        setModalImage(null);
        setActiveImageId(null);
    };

    const navigateImage = (direction) => {
        const currentIndex = images.findIndex(img => img.id === activeImageId);
        const newIndex = (currentIndex + direction + images.length) % images.length;
        setActiveImageId(images[newIndex].id);
        setModalImage(images[newIndex]);
        fetchImageDetails(images[newIndex].id);
    };

    const isAdmin = user && user.role === 'admin';

    const handleDeleteImage = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch(`http://localhost:3000/delete_image/${activeImageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setImages(images.filter(img => img.id !== activeImageId));
                closeModal();
            } else {
                console.error('Failed to delete image');
            }
        } catch (error) {
            console.error('Error deleting image:', error);
        }
    };

    const handleLike = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const userId = jwtDecode(token).userId;
        const hasLiked = userLikedImages.has(activeImageId);

        try {
            const response = hasLiked 
                ? await fetch('http://localhost:3000/remove_like', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ userId, imageId: activeImageId }),
                })
                : await fetch('http://localhost:3000/add_like', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ userId, imageId: activeImageId }),
                });

            if (response.ok) {
                if (hasLiked) {
                    setLikes((prev) => ({
                        ...prev,
                        [activeImageId]: (prev[activeImageId] || 0) - 1,
                    }));
                    setUserLikedImages((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(activeImageId);
                        return newSet;
                    });
                } else {
                    setLikes((prev) => ({
                        ...prev,
                        [activeImageId]: (prev[activeImageId] || 0) + 1,
                    }));
                    setUserLikedImages((prev) => new Set(prev).add(activeImageId));
                }
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Add handler function
    const handleUsernameClick = (user_id) => {
        setModalImage(null); // Close modal
        setModalOpen(false); // Reset modal state
        navigate(`/profile/${user_id}`);
    };

    const constructProfilePicUrl = (path) => {
        if (!path) return '/default-avatar.png';
        const baseUrl = 'http://localhost:3000';
        const picturePath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${picturePath}`;
    };

    // Add loading state
    useEffect(() => {
        let isMounted = true;
        
        const fetchUserProfile = async () => {
            if (!id) return;
            
            try {
                setIsLoading(true);
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:3000/user_profile/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const data = await response.json();
                console.log('Profile data received:', data);
                
                if (!isMounted) return;

                setUsername(data.username);
                setBio(data.bio || '');
                
                const profilePicUrl = constructProfilePicUrl(data.profile_picture);
                console.log('Setting final profile picture URL:', profilePicUrl);
                setProfilePicture(profilePicUrl);
                
            } catch (error) {
                console.error('Error fetching profile:', error);
                if (isMounted) setProfilePicture('/default-avatar.png');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchUserProfile();
        
        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('profile_picture', file);

        const token = localStorage.getItem('token');
        try {
            const response = await fetch('http://localhost:3000/upload_profile_picture', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Profile picture updated:', data);
            setMessage('Profile picture updated successfully.');

            // Re-fetch the profile picture
            await fetchProfilePicture();
        } catch (error) {
            console.error('Error updating profile picture:', error);
            setMessage('Failed to update profile picture.');
        }
    };

    const fetchProfilePicture = async () => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('http://localhost:3000/profile_picture', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setProfilePicture(data.profile_picture);
        } catch (error) {
            console.error('Error fetching profile picture:', error);
        }
    };

    useEffect(() => {
        fetchProfilePicture();
    }, []);

    useEffect(() => {
        // This useEffect will run whenever profilePicture changes
        if (profilePicture) {
            console.log('Profile picture updated:', profilePicture);
        }
    }, [profilePicture]);

    return (
        <div className="profile-container">
            <div className="profile-header-wrapper">
                <div className="profile-header">
                    {!isLoading && (
                        <img 
                            src={profilePicture} 
                            alt={`${username}'s profile`}
                            className="profile-profile-picture" 
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/default-avatar.png';
                            }}
                        />
                    )}
                    <div className="profile-info">
                        <div className="profile-top">
                            <h1 className="profile-username">{username}</h1>
                            {user && user.id === parseInt(id) && (
                                <button className="profile-edit-btn" onClick={() => setIsEditing(true)}>
                                    Edit Profile
                                </button>
                            )}
                        </div>
                        
                        <div className="profile-stats">
                            <div className="stat-item">
                                <span className="stat-number">0</span>
                                <span className="stat-label">Following</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">0</span>
                                <span className="stat-label">Followers</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">0</span>
                                <span className="stat-label">Likes</span>
                            </div>
                        </div>
                        
                        <p className="profile-bio">{bio}</p>
                    </div>
                </div>
            </div>

            {/* Add Tabs */}
            <div className="profile-tabs">
                <button className="tab-btn active">Posts</button>
                <button className="tab-btn">Likes</button>
                <button className="tab-btn">Tagged</button>
            </div>

            {/* Keep existing grid */}
            <div className="profile-grid">
                {images.map((image) => (
                    <div 
                        key={image.id} 
                        className="profile-item"
                        onClick={() => debouncedOpenModal(image)}
                    >
                        <img src={image.image_url} alt={image.prompt} />
                    </div>
                ))}
            </div>

            {modalImage && (
                <div className="profile-modal">
                    <div className="profile-modal-content">
                        <div className="profile-modal-main">
                            <div className="profile-modal-image-container">
                                <button className="profile-close-button" onClick={closeModal}>×</button>
                                <button className="profile-nav-button profile-prev" onClick={() => navigateImage(-1)}>
                                    <span>‹</span>
                                </button>
                                <img className="profile-modal-image" src={modalImage.image_url} alt="Enlarged" />
                                {isAdmin && (
                                    <div className="profile-delete-section">
                                        <button className="profile-delete-button" onClick={handleDeleteImage}>
                                            Delete Image
                                        </button>
                                    </div>
                                )}
                                <button className="profile-nav-button profile-next" onClick={() => navigateImage(1)}>
                                    <span>›</span>
                                </button>
                            </div>
                            <div className="profile-modal-info">
                                <div className="profile-modal-title">
                                    {images.find((img) => img.id === activeImageId)?.prompt}
                                </div>
                                <div className="profile-likes-section">
                                    <button 
                                        className={`profile-like-button ${userLikedImages.has(activeImageId) ? 'liked' : ''}`}
                                        onClick={handleLike}
                                    >
                                        <svg 
                                            className={`profile-like-heart ${userLikedImages.has(activeImageId) ? 'liked' : ''}`} 
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                        </svg>
                                        <span className="profile-like-count">
                                            {likes[activeImageId] || 0}
                                        </span>
                                    </button>
                                </div>

                                <div className="profile-comments-section">
                                    <h4 className="profile-comments-heading">Comments</h4>
                                    <ul className="profile-comments-list">
                                        {(comments[activeImageId] || []).map((comment) => (
                                            <li key={`comment-${comment.id}-${comment.created_at}`} className="profile-comment-item">
                                                <div className="profile-comment-avatar">
                                                    <img 
                                                        src={comment.profile_picture ? 
                                                            `http://localhost:3000/${comment.profile_picture}` : 
                                                            '/default-avatar.png'} 
                                                        alt={comment.username}
                                                        onError={(e) => e.target.src = '/default-avatar.png'}
                                                    />
                                                </div>
                                                <div className="profile-comment-content">
                                                    <div className="profile-comment-header">
                                                        <span 
                                                            className="profile-comment-username"
                                                            onClick={() => handleUsernameClick(comment.user_id)}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            {comment.username}
                                                        </span>
                                                        <span className="profile-comment-time">
                                                            {formatTimestamp(comment.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="profile-comment-text">{comment.comment}</p>
                                                    <div className="profile-comment-actions">
                                                        <button 
                                                            className="profile-comment-like-btn"
                                                            onClick={() => handleCommentLike(comment.id)}
                                                        >
                                                            ♥ {commentLikes[comment.id] || 0}
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <form onSubmit={handleCommentSubmit} className="profile-comment-form">
                                        <input
                                            className="profile-comment-input"
                                            type="text"
                                            value={commentInput}
                                            onChange={(e) => setCommentInput(e.target.value)}
                                            placeholder="Add a comment..."
                                            required
                                        />
                                        <button type="submit" className="profile-comment-submit">Post</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="profile-edit-modal">
                    <div className="profile-edit-modal-content">
                        <div className="profile-edit-header">
                            <h2 className="profile-edit-title">Edit Profile</h2>
                            <button className="profile-edit-close" onClick={() => setIsEditing(false)}>×</button>
                        </div>
                        <div className="profile-edit-form">
                            <div className="profile-picture-section">
                                <img 
                                    src={tempProfilePicture || profilePicture} 
                                    alt="Profile" 
                                    className="profile-edit-picture" 
                                />
                                <input
                                    type="file"
                                    id="profile-picture-input"
                                    accept="image/*"
                                    onChange={handleProfilePictureChange}
                                    style={{ display: 'none' }}
                                />
                                <label 
                                    htmlFor="profile-picture-input" 
                                    className="profile-picture-change-btn"
                                >
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-2.5a2 2 0 100-4 2 2 0 000 4z"/>
                                        <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12z"/>
                                    </svg>
                                    Change photo
                                </label>
                            </div>

                            <div className="profile-edit-field">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={tempUsername}
                                    onChange={(e) => setTempUsername(e.target.value)}
                                    className="profile-edit-input"
                                />
                            </div>

                            <div className="profile-edit-field">
                                <label>Bio</label>
                                <textarea
                                    value={tempBio}
                                    onChange={(e) => setTempBio(e.target.value)}
                                    className="profile-edit-input"
                                    rows={3}
                                />
                            </div>

                            <div className="profile-edit-actions">
                                <button 
                                    className="profile-save-btn"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save'}
                                </button>
                            </div>

                            {message && (
                                <div className="profile-message">
                                    {message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>    
    );
};

export default Profile;