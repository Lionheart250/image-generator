import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext'; // Import the useAuth hook
import { useProfile } from '../context/ProfileContext';
import './Header.css';

const Header = () => {
    const { user, logout } = useAuth(); // Get user info and logout function from context
    const { profilePicture, setProfilePicture } = useProfile();
    const navigate = useNavigate(); // Hook to programmatically navigate
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State to manage dropdown visibility
    const dropdownRef = useRef(null); // Create a ref for the dropdown menu

    const handleLogout = () => {
        logout(); // Call logout function to clear user info
        setIsDropdownOpen(false); // Close the dropdown on logout
        navigate('/'); // Redirect to home after logging out
    };

    const toggleDropdown = () => {
        setIsDropdownOpen((prev) => !prev); // Toggle dropdown visibility
    };

    // Close dropdown when clicking outside of it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        // Bind the event listener
        document.addEventListener('mousedown', handleClickOutside);
        
        // Clean up the event listener on unmount
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownRef]);

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
                    if (data.profile_picture) {
                        setProfilePicture(`http://localhost:3000/${data.profile_picture}`);
                    }
                }
            } catch (error) {
                console.error('Error fetching profile picture:', error);
            }
        };

        if (localStorage.getItem('token')) {
            fetchProfilePicture();
        }
    }, [setProfilePicture]);

    return (
        <header>
            <div className="header-container">
                <Link to="/" className="logo-link" style={{ textDecoration: 'none' }}>
                    <div className="logo">
                        <h1>Anime.AI</h1>
                    </div>
                </Link>
                <nav className="nav-links">
                    <NavLink to="/" end>Home</NavLink>
                    <NavLink to="/gallery">Gallery</NavLink>
                    <NavLink to="/imagegenerator">Create</NavLink>
                </nav>
                <div className="auth-buttons">
                    {user ? (
                        <>
                            <div 
                                className="user-info" 
                                onClick={toggleDropdown} 
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <img 
                                    src={profilePicture} 
                                    alt="Profile" 
                                    className="header-profile-pic" 
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '8px' }} // Adjust the styles as needed
                                />
                                {user.username}
                            </div>
                            {isDropdownOpen && (
                                <div className="dropdown-menu" ref={dropdownRef}>
                                    <button onClick={() => navigate('/upgrade')} className="auth-button upgrade">Upgrade</button>
                                    <button onClick={() => navigate('/credits')} className="auth-button credits">Get Credits</button>
                                    <button onClick={() => navigate(`/profile/${user.id}`)} className="auth-button profile">Profile</button>
                                    <button onClick={() => navigate('/settings')} className="auth-button settings">Settings</button>
                                    <button onClick={() => window.open('https://discord.com', '_blank')} className="auth-button discord">Discord</button>
                                    <button onClick={() => navigate('/contact')} className="auth-button contact">Contact</button>
                                    <button onClick={() => navigate('/guide')} className="auth-button guide">Guide</button>
                                    <button onClick={() => navigate('/affiliate')} className="auth-button affiliate">Affiliate</button>
                                    <button onClick={() => navigate('/language')} className="auth-button language">Language</button>
                                    <button onClick={() => navigate('/darkmode')} className="auth-button darkmode">Dark Mode</button>
                                    <button onClick={handleLogout} className="auth-button logout">Logout</button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={() => navigate('/login')} className="auth-button login">Log In</button>
                            <button onClick={() => navigate('/signup')} className="auth-button signup">Sign Up</button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
