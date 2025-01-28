import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));

    const clearAuth = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setRefreshToken(null);
        setUser(null);
    }, []);

    const decodeAndSetUser = useCallback((token) => {
        try {
            const decodedToken = jwtDecode(token);
            setUser({
                id: decodedToken.userId,
                username: decodedToken.username,
                role: decodedToken.role,
            });
        } catch (error) {
            console.error('Failed to decode token:', error);
            clearAuth();
        }
    }, [clearAuth]);

    const isTokenExpired = useCallback((token) => {
        try {
            const { exp } = jwtDecode(token);
            return Date.now() >= exp * 1000;
        } catch {
            return true;
        }
    }, []);

    const login = useCallback((newToken, newRefreshToken) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        decodeAndSetUser(newToken);
    }, [decodeAndSetUser]);

    const logout = useCallback(() => {
        clearAuth();
    }, [clearAuth]);

    useEffect(() => {
        const refreshAuthToken = async () => {
            if (refreshToken && isTokenExpired(token)) {
                try {
                    const response = await axios.post('http://localhost:3000/refresh', { refreshToken });
                    const { token: newToken, refreshToken: newRefreshToken } = response.data;
                    login(newToken, newRefreshToken);
                } catch (error) {
                    console.error('Failed to refresh token:', error);
                    clearAuth();
                }
            } else if (token) {
                decodeAndSetUser(token);
            }
        };

        refreshAuthToken();
    }, [token, refreshToken, decodeAndSetUser, isTokenExpired]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
