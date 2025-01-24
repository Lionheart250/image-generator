import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useProfile } from '../context/ProfileContext';
import './Header.css';
import { ReactComponent as ExploreIcon } from '../assets/icons/explore.svg';
import { ReactComponent as CreateIcon } from '../assets/icons/create.svg';
import { ReactComponent as FollowingIcon } from '../assets/icons/following.svg';
import { ReactComponent as UpgradeIcon } from '../assets/icons/upgrade.svg';
import { ReactComponent as CreditsIcon } from '../assets/icons/credits.svg';
import { ReactComponent as SettingsIcon } from '../assets/icons/settings.svg';
import { ReactComponent as MoreIcon } from '../assets/icons/more.svg';

const Header = () => {
    const { user, logout } = useAuth();
    const { profilePicture } = useProfile();
    const navigate = useNavigate();
    const location = useLocation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [headerProfilePic, setHeaderProfilePic] = useState(profilePicture || '/default-avatar.png');
    const [headerPosition, setHeaderPosition] = useState('side');
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef(null);
    const moreButtonRef = useRef(null);
    const [expandedSection, setExpandedSection] = useState(null);

    useEffect(() => {
        const fetchProfilePicture = async () => {
            if (user) {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`http://localhost:3000/user_profile/${user.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    setHeaderProfilePic(data.profile_picture || '/default-avatar.png');
                } catch (error) {
                    console.error('Error fetching profile picture:', error);
                }
            }
        };
        fetchProfilePicture();
    }, [user]);

    useEffect(() => {
        const topHeaderPages = ['/'];
        const shouldBeTop = topHeaderPages.includes(location.pathname);
        setHeaderPosition(shouldBeTop ? 'top' : 'side');
    }, [location]);

    const handleLogout = () => {
        logout();
        setIsDropdownOpen(false);
        navigate('/');
    };

    const toggleMoreMenu = () => {
        setIsMoreMenuOpen(!isMoreMenuOpen);
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (isMoreMenuOpen && 
                !moreButtonRef.current?.contains(event.target) && 
                !moreMenuRef.current?.contains(event.target)) {
                setIsMoreMenuOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isMoreMenuOpen]);

    return (
        <>
            <header className={`header ${headerPosition}-header ${isMoreMenuOpen ? 'drawer-open' : ''}`}>
                <div className="header-container">
                    <Link to="/" className="logo-link" style={{ textDecoration: 'none' }}>
                        <div className="logo">
                            <h1>Anime.AI</h1>
                        </div>
                    </Link>
                    <nav className="nav-links">
                        {headerPosition === 'top' && (
                            <>
                                <NavLink to="/gallery" end>Explore</NavLink>
                                <NavLink to="/imagegenerator">Create</NavLink>
                                <NavLink to="/following">Following</NavLink>
                            </>
                        )}
                        {headerPosition === 'side' && user && (
                            <>
                                <NavLink to="/gallery" className="side-nav-link">
                                    <ExploreIcon className="nav-icon" />
                                    <span>Explore</span>
                                </NavLink>
                                <NavLink to="/imagegenerator" className="side-nav-link">
                                    <CreateIcon className="nav-icon" />
                                    <span>Create</span>
                                </NavLink>
                                <NavLink to="/following" className="side-nav-link">
                                    <FollowingIcon className="nav-icon" />
                                    <span>Following</span>
                                </NavLink>
                                <NavLink to={`/profile/${user.id}`} className="side-nav-link">
                                    <img src={headerProfilePic} alt="Profile" className="nav-icon header-profile-pic" />
                                    <span>Profile</span>
                                </NavLink>
                                <NavLink to="/upgrade" className="side-nav-link">
                                    <UpgradeIcon className="nav-icon" />
                                    <span>Upgrade</span>
                                </NavLink>
                                <NavLink to="/credits" className="side-nav-link">
                                    <CreditsIcon className="nav-icon" />
                                    <span>Credits</span>
                                </NavLink>
                                <NavLink to="/settings" className="side-nav-link">
                                    <SettingsIcon className="nav-icon" />
                                    <span>Settings</span>
                                </NavLink>
                                <button 
                                    className="side-nav-link more-menu-button" 
                                    onClick={toggleMoreMenu}
                                    ref={moreButtonRef}
                                >
                                    <MoreIcon className="nav-icon" />
                                    <span>More</span>
                                </button>
                            </>
                        )}
                    </nav>
                    {headerPosition === 'top' && (
                        <div className="auth-buttons">
                            {user ? (
                                <div className="profile-dropdown" ref={dropdownRef}>
                                    <img 
                                        src={headerProfilePic} 
                                        alt="Profile" 
                                        className="header-profile-pic" 
                                        onClick={toggleDropdown} 
                                    />
                                    {isDropdownOpen && (
                                        <div className="dropdown-menu">
                                            <NavLink to={`/profile/${user.id}`}>Profile</NavLink>
                                            <NavLink to="/upgrade">Upgrade</NavLink>
                                            <NavLink to="/credits">Credits</NavLink>
                                            <NavLink to="/settings">Settings</NavLink>
                                            <button onClick={handleLogout}>Log out</button>
                                        </div>
                                    )}
                                    <span className="header-username">{user.username}</span>
                                </div>
                            ) : (
                                <>
                                    <NavLink to="/login">Login</NavLink>
                                    <NavLink to="/signup">Sign Up</NavLink>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </header>
            
            {isMoreMenuOpen && (
                <div className="more-drawer-container open" ref={moreMenuRef}>
                    <div className="more-dropdown-menu">
                        <NavLink to="/settings">Settings</NavLink>
                        <NavLink to="/language">Language</NavLink>
                        <NavLink to="/feedback">Feedback</NavLink>
                        <NavLink to="/keyboard">Keyboard shortcuts</NavLink>
                        <button onClick={handleLogout} className="logout-button">
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;
