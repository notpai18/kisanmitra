import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RoleBasedRouteProps {
  element: React.ReactElement;
  allowedRoles: string[];
}

export default function RoleBasedRoute({ element, allowedRoles }: RoleBasedRouteProps) {
  const { userData } = useAuth();
  const role = userData?.role;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
}
