import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataStore } from '../../lib/dataStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    checkFirstRunAndSession();
  }, []);

  const checkFirstRunAndSession = async () => {
    try {
      const company = await dataStore.getCompany();
      const users = await dataStore.getUsers();
      
      const hasAdmin = users.some(u => u.role === 'admin' && u.status === 'active');
      if (!company || !hasAdmin) {
        setIsFirstRun(true);
        setLoading(false);
        return;
      } else {
        setIsFirstRun(false);
      }

      // Restore existing session
      const savedSession = localStorage.getItem('hcm_active_session');
      if (savedSession) {
        try {
          const user = JSON.parse(savedSession);
          // Re-validate the user still exists and is active
          const freshUser = users.find(u => u.id === user.id);
          if (freshUser && freshUser.status === 'active') {
            setCurrentUser(freshUser);
            // If employee, load their profile record
            if (freshUser.role === 'employee') {
              const employees = await dataStore.getEmployees();
              const emp = employees.find(
                e => e.user_id === freshUser.id || e.email.toLowerCase() === freshUser.email.toLowerCase()
              );
              setCurrentEmployee(emp || null);
            }
          } else {
            // Session stale or user deactivated — clear it
            localStorage.removeItem('hcm_active_session');
          }
        } catch {
          localStorage.removeItem('hcm_active_session');
        }
      }
    } catch (e) {
      console.error('Auth initialization error:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const users = await dataStore.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) throw new Error('Invalid email or password.');
    if (user.status === 'deactivated') throw new Error('This account has been deactivated. Contact your Admin.');

    // Trim input password and stored passwords to prevent whitespace issues
    const inputPass = String(password || '').trim();
    const storedPass = String(user.password || user.password_hash || '').trim();
    const storedTempPass = String(user.temp_password || '').trim();

    // Allow login with permanent password OR temp password
    const passwordMatch =
      (storedPass && (storedPass === inputPass || storedPass === password)) ||
      (storedTempPass && (storedTempPass === inputPass || storedTempPass === password));

    if (!passwordMatch) throw new Error('Invalid email or password.');

    let emp = null;
    if (user.role === 'employee') {
      const employees = await dataStore.getEmployees();
      emp = employees.find(
        e => e.user_id === user.id || e.email.toLowerCase() === user.email.toLowerCase()
      );
      setCurrentEmployee(emp || null);
    }

    setCurrentUser(user);
    localStorage.setItem('hcm_active_session', JSON.stringify(user));
    await dataStore.logAudit(user, 'LOGIN', 'user', user.id, null, { email: user.email, role: user.role });
    return user;
  };

  const logout = async () => {
    try {
      if (currentUser) {
        await dataStore.logAudit(currentUser, 'LOGOUT', 'user', currentUser.id);
      }
    } catch (e) {
      console.warn('Audit logout error:', e);
    } finally {
      setCurrentUser(null);
      setCurrentEmployee(null);
      localStorage.removeItem('hcm_active_session');
      localStorage.removeItem('hcm_session');
    }
  };

  const changePassword = async (newPassword) => {
    if (!currentUser) throw new Error('Not authenticated');
    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const updatedUser = {
      ...currentUser,
      password: newPassword,
      temp_password: null,
      must_change_password: false
    };
    await dataStore.saveUser(updatedUser, currentUser);
    setCurrentUser(updatedUser);
    localStorage.setItem('hcm_active_session', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const refreshUser = async () => {
    await checkFirstRunAndSession();
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentEmployee,
      setCurrentEmployee,
      loading,
      isFirstRun,
      setIsFirstRun,
      login,
      logout,
      changePassword,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
