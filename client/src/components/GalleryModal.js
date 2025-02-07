import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Ensure jwt-decode is installed
import { ReactComponent as LikeIcon } from '../assets/icons/like.svg';
import { ReactComponent as CommentIcon } from '../assets/icons/comment.svg';
import { ReactComponent as ShareIcon } from '../assets/icons/share.svg';
import { ReactComponent as BookmarkIcon } from '../assets/icons/bookmark.svg';
import './GalleryModal.css';

const GalleryModal = ({ 
    modalImage,
    activeImageId,
    images, // Added images prop
    isAdmin,
    imageUserDetails,
    onClose,
    onNavigate,
    onDelete,
    onUsernameClick,
    formatDate,
    formatTimestamp,
}) => {
    // Local state moved from Gallery
    const [commentInput, setCommentInput] = useState('');
    const [likes, setLikes] = useState({});
    const [comments, setComments] = useState({});
    const [commentLikes, setCommentLikes] = useState({});
    const [userLikedImages, setUserLikedImages] = useState(new Set());
    const [userLikedComments, setUserLikedComments] = useState(new Set());
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);

    const closeModal = () => { onClose(); };

    // Fetch comments and likes when activeImageId changes
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !activeImageId) return;
    
        const fetchCommentsAndLikes = async () => {
            try {
                // Fetch comments for the active image
                const commentsResponse = await fetch(`http://localhost:3000/fetch_comments?id=${activeImageId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (commentsResponse.ok) {
                    const data = await commentsResponse.json();
                    setComments(prev => ({
                        ...prev,
                        [activeImageId]: data.comments
                    }));
                } else {
                    console.error('Error fetching comments');
                }
                
                // Fetch like count for the active image
                const likesResponse = await fetch(`http://localhost:3000/likes/${activeImageId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (likesResponse.ok) {
                    const data = await likesResponse.json();
                    setLikes(prev => ({
                        ...prev,
                        [activeImageId]: data.count
                    }));
                } else {
                    console.error('Error fetching likes');
                }
            } catch (error) {
                console.error('Error fetching comments and likes:', error);
            }
        };
    
        fetchCommentsAndLikes();
    }, [activeImageId]);

    // Handle adding a comment
    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const decoded = jwtDecode(token);
            const userId = decoded.userId;
            const response = await fetch('http://localhost:3000/add_comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userId, imageId: activeImageId, comment: commentInput }),
            });
            if (response.ok) {
                // Refresh comments after successful post
                const commentsResponse = await fetch(`http://localhost:3000/fetch_comments?id=${activeImageId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (commentsResponse.ok) {
                    const data = await commentsResponse.json();
                    setComments(prev => ({
                        ...prev,
                        [activeImageId]: data.comments
                    }));
                } else {
                    console.error('Error fetching comments');
                }
            } else {
                console.error('Error adding comment:', await response.json());
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
        setCommentInput('');
    };

    // Fetch updated like count for a comment
    const fetchCommentLikeCount = async (commentId) => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`http://localhost:3000/comment_likes/${commentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch like count');
            const data = await response.json();
            setCommentLikes(prev => ({
                ...prev,
                [commentId]: data.count
            }));
        } catch (error) {
            console.error('Error fetching comment like count:', error);
        }
    };

    // Toggle image like
    const handleLike = async (imageId) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const isLiked = userLikedImages.has(imageId);
        try {
            const response = await fetch(`http://localhost:3000/likes/${imageId}`, {
                method: isLiked ? 'DELETE' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to ${isLiked ? 'unlike' : 'like'} image`);
            }
            const data = await response.json();
            setLikes(prev => ({
                ...prev,
                [imageId]: data.count
            }));
            setUserLikedImages(prev => {
                const newSet = new Set(prev);
                isLiked ? newSet.delete(imageId) : newSet.add(imageId);
                return newSet;
            });
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    // Toggle comment like
    const handleCommentLike = async (commentId) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const isLiked = userLikedComments.has(commentId);
        try {
            const response = await fetch(`http://localhost:3000/comment_likes/${commentId}`, {
                method: isLiked ? 'DELETE' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to toggle comment like');
            }
            setUserLikedComments(prev => {
                const newSet = new Set(prev);
                isLiked ? newSet.delete(commentId) : newSet.add(commentId);
                return newSet;
            });
            await fetchCommentLikeCount(commentId);
        } catch (error) {
            console.error('Error toggling comment like:', error);
        }
    };

    return (
        <div className="gallery-modal">
            <div className="gallery-modal-content">
                <div className="gallery-modal-main">
                    <div className="gallery-modal-image-container">
                        <button className="gallery-close-button" onClick={closeModal}>×</button>
                        <button className="gallery-nav-button gallery-prev" onClick={() => onNavigate(-1)}>
                            <span>‹</span>
                        </button>
                        <img className="gallery-modal-image" src={modalImage} alt="Enlarged" />
                        {isAdmin && (
                            <div className="gallery-delete-section">
                                <button 
                                    className="gallery-delete-button" 
                                    onClick={() => onDelete(activeImageId)}
                                >
                                    Delete Image
                                </button>
                            </div>
                        )}
                        <button className="gallery-nav-button gallery-next" onClick={() => onNavigate(1)}>
                            <span>›</span>
                        </button>
                    </div>
                    <div className="gallery-modal-info">
                        <div className="gallery-user-info">
                            <img 
                                src={imageUserDetails[activeImageId]?.profile_picture || '/default-avatar.png'}
                                alt="Profile"
                                className="gallery-user-avatar"
                                onClick={() => onUsernameClick(imageUserDetails[activeImageId]?.user_id)}
                            />
                            <div className="gallery-user-details">
                                <h4 onClick={() => onUsernameClick(imageUserDetails[activeImageId]?.user_id)}>
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
                                                    onClick={() => onUsernameClick(comment.user_id)}
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
    );
};

export default GalleryModal;