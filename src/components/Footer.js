import React, { useEffect, useState } from 'react';
import './Footer.css';

const Footer = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= documentHeight) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <footer className={`footer ${isVisible ? 'visible' : 'hidden'}`}>
            <div className="footer-content">
                <div className="footer-brand">
                    <h3>Anime.AI</h3>
                </div>
                <div className="footer-links">
                    <a href="/about">About</a>
                    <a href="/privacy">Privacy</a>
                    <a href="/terms">Terms</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;