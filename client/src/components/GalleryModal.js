import React, { useState } from 'react';
import './ImageModal.css';

const ImageModal = ({ 
    image, 
    isOpen, 
    onClose, 
    onDelete, 
    onLike, 
    onComment, 
    comments,
    likes,
    isAdmin,
    userLikedComments,
    handleCommentLike 
}) => {
    const [comment, setComment] = useState('');
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);

    return (
        <div className={`gallery-modal ${isOpen ? 'open' : ''}`}>
            {/* ...existing modal content... */}
        </div>
    );
};

export default ImageModal;