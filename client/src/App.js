import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import ImageGenerator from './pages/ImageGenerator';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <Router>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/imagegenerator" element={<ImageGenerator />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
          <Footer />
        </Router>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
