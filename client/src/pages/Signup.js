import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // Ensure jwtDecode is imported with curly braces
import { useAuth } from '../context/AuthContext'; // Import useAuth to access the AuthContext
import { useProfile } from '../context/ProfileContext';
import './Signup.css';

function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth(); // Destructure login from useAuth
  const { setProfilePicture } = useProfile(); // Destructure setProfilePicture from useProfile

  const fetchProfilePicture = async (token) => {
    try {
      const response = await fetch('http://localhost:3000/profile_picture', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.profile_picture) {
          setProfilePicture(`http://localhost:3000/${data.profile_picture}`);
        }
      } else {
        console.error('Failed to fetch profile picture:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = { username, email, password };

    try {
      const response = await fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Signup response status:', response.status);
      console.log('Signup response data:', data);

      if (response.ok) {
        // Store the token and refresh token
        const { token, refreshToken } = data;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);

        // Decode the token to get user information
        const decodedToken = jwtDecode(token);
        localStorage.setItem('userId', decodedToken.userId); // Save userId to localStorage

        // Call the login function to update the user context
        login(token, refreshToken); // Add refresh token if available

        // Fetch and set the profile picture
        await fetchProfilePicture(token);

        alert(data.message);
        navigate('/'); // Redirect to the home page or dashboard
      } else {
        setError(data.error || 'An error occurred.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Failed to connect to the server.');
    }
  };

  return (
    <div className="signup-container">
        <h2 className="signup-page-heading">Sign Up</h2>
        <form onSubmit={handleSubmit} className="signup-form">
            <div className="signup-form-group">
                <label className="signup-label" htmlFor="username">Username:</label>
                <input
                    className="signup-input"
                    type="text"
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            <div className="signup-form-group">
                <label className="signup-label" htmlFor="email">Email:</label>
                <input
                    className="signup-input"
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div className="signup-form-group">
                <label className="signup-label" htmlFor="password">Password:</label>
                <input
                    className="signup-input"
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            {error && <div className="signup-error">{error}</div>}
            <button type="submit" className="signup-button">Sign Up</button>
        </form>
    </div>
  );
}

export default Signup;
