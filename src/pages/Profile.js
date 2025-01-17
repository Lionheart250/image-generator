import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useProfile } from '../context/ProfileContext';
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

    useEffect(() => {
        // Fetch user bio and posts
        fetchUserProfile();
    }, [id]);

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`http://localhost:3000/user_profile/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Fetched user profile data:', data); // Debugging statement
            setUsername(data.username);
            setBio(data.bio);
            setProfilePicture(`http://localhost:3000/${data.profile_picture}`);
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('http://localhost:3000/update_profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, bio })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setMessage(data.message);
            setIsEditing(false);
        } catch (error) {
            console.error('Error:', error);
            setMessage('Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-container">
            <div className="profile-header">
                <img src={profilePicture} alt="Profile" className="profile-profile-picture" />
                <div className="profile-info">
                    <h1 className="profile-username">{username}</h1>
                    <p className="profile-bio">{bio}</p>
                    <button className="profile-edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                </div>
            </div>
            <div className="profile-posts">
                {posts.map((post) => (
                    <div key={post.id} className="profile-post">
                        <img src={post.imageUrl} alt={post.caption} className="profile-post-image" />
                    </div>
                ))}
            </div>
            {isEditing && (
                <div className="profile-modal">
                    <div className="profile-modal-content">
                        <span className="profile-close" onClick={() => setIsEditing(false)}>&times;</span>
                        <form className="profile-form" onSubmit={handleSubmit}>
                            <label className="profile-label">
                                Username:
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    className="profile-input"
                                />
                            </label>
                            <label className="profile-label">
                                Bio:
                                <textarea 
                                    value={bio} 
                                    onChange={(e) => setBio(e.target.value)} 
                                    className="profile-input"
                                />
                            </label>
                            <div className="profile-picture-section">
                                <img src={profilePicture} alt="Profile" className="profile-picture" />
                                <input type="file" onChange={handleProfilePictureChange} className="profile-file-input" />
                            </div>
                            {loading && <p className="profile-loading">Loading...</p>}
                            <button type="submit" className="profile-submit">Update Profile</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;