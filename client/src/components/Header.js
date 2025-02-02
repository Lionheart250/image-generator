import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import  './Header.css';
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
    const [headerProfilePic, setHeaderProfilePic] = useState('/default-avatar.png');
    const [headerPosition, setHeaderPosition] = useState('side');
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef(null);
    const moreButtonRef = useRef(null);

    // Log user object to check structure
    useEffect(() => {
        console.log('Current user object:', user);
    }, [user]);

    // Profile picture fetch effect
    useEffect(() => {
        const fetchProfilePicture = async () => {
            const token = localStorage.getItem('token');
            const decodedToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
            
            console.log('Token payload:', decodedToken);
            console.log('Current user state:', user);
            
            if (!token || !decodedToken?.userId) {
                console.log('Missing auth data:', { token: !!token, decodedToken });
                return;
            }
    
            try {
                const response = await fetch('http://localhost:3000/profile_picture', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
    
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Server response:', errorData);
                    throw new Error(JSON.stringify(errorData));
                }

                const data = await response.json();
                if (data.profile_picture) {
                    setHeaderProfilePic(`http://localhost:3000/${data.profile_picture}`);
                }
            } catch (error) {
                console.error('Profile picture fetch error:', error);
                setHeaderProfilePic('/default-avatar.png');
            }
        };

        // Only fetch if we have a user
        if (user && user.id) {
            fetchProfilePicture();
        }
    }, [user]); // Add user as dependency

    // Header position effect
    useEffect(() => {
        const topHeaderPages = ['/'];
        const shouldBeTop = topHeaderPages.includes(location.pathname);
        setHeaderPosition(shouldBeTop ? 'top' : 'side');
    }, [location.pathname]);

    const handleLogout = ()  => {
        logout();
        setIsDropdownOpen(false);
        setIsMoreMenuOpen(false);
        navigate('/');
    };

    const toggleMoreMenu = () => {
        setIsMoreMenuOpen(!isMoreMenuOpen);
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    // Click outside effect
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
    }, [isMoreMenuOpen]); // Add isMoreMenuOpen dependency

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
                        {headerPosition === 'side' && (
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
                                {user ? (
                                    <NavLink to={`/profile/${user.id}`} className="side-nav-link">
                                        <img src={headerProfilePic} alt="Profile" className="nav-icon header-profile-pic" />
                                        <span>Profile</span>
                                    </NavLink>
                                ) : (
                                    <NavLink to="/login" className="side-nav-link">
                                        <img src="/default-avatar.png" alt="Sign In" className="nav-icon header-profile-pic" />
                                        <span>Sign In</span>
                                    </NavLink>
                                )}
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
                        <div className="header-auth-buttons">
                            {user ? (
                                <div className="profile-dropdown" onClick={toggleDropdown} ref={dropdownRef}>
                                    <img 
                                        src={headerProfilePic} 
                                        alt="Profile" 
                                        className="header-profile-pic"
                                    />
                                    <span className="header-username">{user.username}</span>
                                    {isDropdownOpen && (
                                        <div className="dropdown-menu">
                                            <NavLink to={`/profile/${user.id}`}>Profile</NavLink>
                                            <NavLink to="/upgrade">Upgrade</NavLink>
                                            <NavLink to="/credits">Credits</NavLink>
                                            <NavLink to="/settings">Settings</NavLink>
                                            <button onClick={handleLogout} className="logout-btn">Log out</button>
                                        </div>
                                    )}
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
