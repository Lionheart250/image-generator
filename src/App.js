import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import ImageGenerator from './pages/ImageGenerator'; // Import the ImageGenerator component
import Login from './pages/Login';
import Signup from './pages/Signup';
import Settings from './pages/Settings';
import Header from './components/Header'; // Header component
import Footer from './components/Footer'; // Import the Footer component
import { AuthProvider } from './AuthContext'; // Import the AuthProvider
import { ProfileProvider } from './context/ProfileContext'; // Import the ProfileProvider
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <Router>
          <Header /> {/* Add the Header component */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/imagegenerator" element={<ImageGenerator />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
          <Footer /> {/* Add the Footer component */}
        </Router>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
