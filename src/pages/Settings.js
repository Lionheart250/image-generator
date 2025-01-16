import React, { useState, useEffect } from 'react';
import './Settings.css';
import { useProfile } from '../context/ProfileContext';

const Settings = () => {
    const { profilePicture, setProfilePicture } = useProfile();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

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
            setLoading(true);
            const formData = new FormData();
            formData.append('profile_picture', file);

            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('No authentication token found');
                }

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
                setProfilePicture(`http://localhost:3000/${data.profilePicturePath}`);
                setMessage('Profile picture updated successfully!');
            } catch (error) {
                console.error('Error:', error);
                setMessage('Failed to update profile picture.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle other form field submissions here if needed
    };

    return (
        <div className="settings-container">
            <h1>Settings</h1>
            {message && <div className="settings-message">{message}</div>}
            <form className="settings-form" onSubmit={handleSubmit}>
                <label>
                    Username:
                    <input type="text" name="username" />
                </label>
                <label>
                    Email:
                    <input type="email" name="email" />
                </label>
                <label>
                    Password:
                    <input type="password" name="password" />
                </label>
                <div className="profile-picture-section">
                    <img 
                        src={profilePicture} 
                        alt="Profile" 
                        className={`profile-picture ${loading ? 'loading' : ''}`} 
                    />
                    <input 
                        type="file" 
                        id="profile-picture-input" 
                        accept="image/*" 
                        onChange={handleProfilePictureChange}
                        disabled={loading}
                    />
                    <label 
                        htmlFor="profile-picture-input" 
                        className={`profile-picture-label ${loading ? 'disabled' : ''}`}
                    >
                        {loading ? 'Uploading...' : 'Change Profile Picture'}
                    </label>
                </div>
                <button type="submit" disabled={loading}>Save Changes</button>
            </form>
        </div>
    );
};

export default Settings;
