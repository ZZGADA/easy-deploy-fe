import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Team from './pages/Team';
import Repositories from './pages/Repositories';
import { authService } from './services/api';

const App: React.FC = () => {
  const isAuthenticated = authService.isAuthenticated();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/easy-deploy" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/easy-deploy" />} />
        <Route
          path="/easy-deploy/*"
          element={
            isAuthenticated ? (
              <MainLayout>
                <Routes>
                  <Route path="profile" element={<Profile />} />
                  <Route path="team" element={<Team />} />
                  <Route path="repositories" element={<Repositories />} />
                  <Route path="" element={<Navigate to="profile" />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="/" element={<Navigate to="/easy-deploy" />} />
      </Routes>
    </Router>
  );
};

export default App;
