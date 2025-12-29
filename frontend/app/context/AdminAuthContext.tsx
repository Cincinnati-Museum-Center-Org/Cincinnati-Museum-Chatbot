'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminUser {
  username: string;
  email?: string;
  accessToken: string;
  idToken: string;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string; newPasswordRequired?: boolean }>;
  signOut: () => void;
  completeNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Get Cognito config from environment
const COGNITO_USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

// Cognito Auth API URL
const COGNITO_URL = `https://cognito-idp.${AWS_REGION}.amazonaws.com/`;

interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('adminUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // TODO: Validate token expiration
        setUser(parsed);
      } catch {
        localStorage.removeItem('adminUser');
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (username: string, password: string): Promise<{ success: boolean; error?: string; newPasswordRequired?: boolean }> => {
    try {
      const response = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: COGNITO_CLIENT_ID,
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      });

      const data = await response.json();

      if (data.__type) {
        // Error response
        if (data.__type.includes('NotAuthorizedException')) {
          return { success: false, error: 'Invalid username or password' };
        }
        if (data.__type.includes('UserNotFoundException')) {
          return { success: false, error: 'User not found' };
        }
        return { success: false, error: data.message || 'Authentication failed' };
      }

      // Check for NEW_PASSWORD_REQUIRED challenge
      if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        setPendingSession(data.Session);
        setPendingUsername(username);
        return { success: false, newPasswordRequired: true };
      }

      // Success - extract tokens
      const authResult = data.AuthenticationResult;
      if (authResult) {
        const adminUser: AdminUser = {
          username,
          accessToken: authResult.AccessToken,
          idToken: authResult.IdToken,
        };
        setUser(adminUser);
        localStorage.setItem('adminUser', JSON.stringify(adminUser));
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from authentication service' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const completeNewPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingSession || !pendingUsername) {
      return { success: false, error: 'No pending password change' };
    }

    try {
      const response = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
        },
        body: JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          ClientId: COGNITO_CLIENT_ID,
          Session: pendingSession,
          ChallengeResponses: {
            USERNAME: pendingUsername,
            NEW_PASSWORD: newPassword,
          },
        }),
      });

      const data = await response.json();

      if (data.__type) {
        return { success: false, error: data.message || 'Failed to set new password' };
      }

      const authResult = data.AuthenticationResult;
      if (authResult) {
        const adminUser: AdminUser = {
          username: pendingUsername,
          accessToken: authResult.AccessToken,
          idToken: authResult.IdToken,
        };
        setUser(adminUser);
        localStorage.setItem('adminUser', JSON.stringify(adminUser));
        setPendingSession(null);
        setPendingUsername(null);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response' };
    } catch (error) {
      console.error('Complete new password error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('adminUser');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        completeNewPassword,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
