import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AuthForm } from '../ui/AuthForm';

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  return <AuthForm mode="login" onSwitch={() => navigation.replace('Register')} />;
}

export function RegisterScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Register'>) {
  return <AuthForm mode="register" onSwitch={() => navigation.replace('Login')} />;
}
