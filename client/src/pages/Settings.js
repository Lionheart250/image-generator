import React, { useState, useEffect } from 'react';
import './Settings.css';
import { useProfile } from '../context/ProfileContext';

const Settings = () => {
    const { profilePicture, setProfilePicture } = useProfile();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [tempProfilePicture, setTempProfilePicture] = useState(null);
    const [profilePictureFile, setProfilePictureFile] = useState(null);

    // Fetch initial profile picture
    useEffect(() => {
        const fetchProfilePicture = async () => {
            try {
                const response = await fetch('http://localhost:3000/profile_picture', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.profile_picture) { // Make sure to access the correct field
                        setProfilePicture(`http://localhost:3000/${data.profile_picture}`);
                    }
                } else {
                    throw new Error(`Failed to fetch: ${response.statusText}`);
                }
            } catch (error) {
                console.error('Error fetching profile picture:', error);
            }
        };

        fetchProfilePicture();
    }, []);

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
            const formData = new FormData();
            
            if (profilePictureFile) {
                formData.append('image', profilePictureFile);
                
                const response = await fetch('http://localhost:3000/upload_profile_picture', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to upload profile picture');
                }

                setProfilePicture(`http://localhost:3000/${data.profilePicturePath}`);
            }

            setMessage('Profile updated successfully');
        } catch (error) {
            console.error('Profile update error:', error);
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-content">
                <h2>Settings</h2>
                <div className="settings-section">
                    <div className="profile-picture-section">
                        <img 
                            src={tempProfilePicture || profilePicture} 
                            alt="Profile" 
                            className="settings-profile-picture" 
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
                    <div className="settings-actions">
                        <button 
                            className="settings-save-btn"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                    {message && (
                        <div className="settings-message">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
