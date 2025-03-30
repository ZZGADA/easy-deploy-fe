import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Team from './pages/Team';
import Repositories from './pages/Repositories';
import DockerManage from './pages/DockerManage';
import { authService } from './services/api';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/easy-deploy/login" />;
  }
  return <MainLayout>{children}</MainLayout>;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/easy-deploy/login" element={<Login />} />
        <Route path="/easy-deploy/register" element={<Register />} />
        <Route
          path="/easy-deploy/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/easy-deploy/team"
          element={
            <PrivateRoute>
              <Team />
            </PrivateRoute>
          }
        />
        <Route
          path="/easy-deploy/repositories"
          element={
            <PrivateRoute>
              <Repositories />
            </PrivateRoute>
          }
        />
        <Route
          path="/easy-deploy/docker"
          element={
            <PrivateRoute>
              <DockerManage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/easy-deploy/login" />} />
      </Routes>
    </Router>
  );
};

export default App;
