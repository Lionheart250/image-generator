import React, { createContext, useContext, useState } from 'react';

const ProfileContext = createContext();

export const ProfileProvider = ({ children }) => {
    const [profilePicture, setProfilePicture] = useState('/default-avatar.png');

    return (
        <ProfileContext.Provider value={{ profilePicture, setProfilePicture }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => useContext(ProfileContext);