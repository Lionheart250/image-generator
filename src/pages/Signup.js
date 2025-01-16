import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = { username, email, password };

    try {
      const response = await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        navigate('/login'); // Redirect to login page
      } else {
        setError(data.error || 'An error occurred.');
      }
    } catch (err) {
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
                    required
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
                    required
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
                    required
                />
            </div>
            <button type="submit" className="signup-submit-btn">Sign Up</button>
            {error && <p className="signup-error">{error}</p>}
        </form>
    </div>
  );
}

export default Signup;
