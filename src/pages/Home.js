import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
    return (
        <div className="home-container">
            <div className="home-hero">
                <h1 className="home-title">
                    Welcome to <span className="highlight">Anime.AI</span>
                </h1>
                <p className="home-subtitle">
                    Create beautiful anime-style images with the power of AI
                </p>
                <div className="home-cta">
                    <Link to="/imagegenerator" className="home-button primary">
                        Start Creating
                    </Link>
                    <Link to="/gallery" className="home-button secondary">
                        View Gallery
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Home;
