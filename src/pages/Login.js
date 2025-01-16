import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { jwtDecode } from 'jwt-decode'; 
import { useAuth } from '../AuthContext'; // Import useAuth to access the AuthContext
import { useProfile } from '../context/ProfileContext';
import './Login.css';

const Login = () => {
    const { setProfilePicture } = useProfile();
    const navigate = useNavigate(); 
    const { login } = useAuth(); // Access login function from AuthContext
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

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
            }
        } catch (error) {
            console.error('Error fetching profile picture:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = { email, password };

        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (response.ok) {
                // Store token and userId
                const { token, refreshToken } = data; // Assuming the response also includes a refresh token
                localStorage.setItem('token', token); // Save the token for future use

                // Decode token to get userId
                const decodedToken = jwtDecode(token);
                localStorage.setItem('userId', decodedToken.userId); // Save userId to localStorage
                
                // Call the login function to update the user context
                login(token, refreshToken); // Add refresh token if available

                await fetchProfilePicture(token);

                navigate('/'); // Redirect to home page
            } else {
                alert(data.error || 'An error occurred.');
            }
        } catch (err) {
            alert('Failed to connect to the server.');
        }
    };

    return (
        <div className="login-container">
            <h2 className="login-heading">Login</h2>
            <form id="login-form" className="login-form" onSubmit={handleSubmit}>
                <div className="login-form-group">
                    <label className="login-label" htmlFor="email">Email:</label>
                    <input
                        className="login-input"
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="login-form-group">
                    <label className="login-label" htmlFor="password">Password:</label>
                    <input
                        className="login-input"
                        type="password"
                        id="password"
                        name="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <button type="submit" className="login-submit-btn">Log In</button>
            </form>
        </div>
    );
};

export default Login;
