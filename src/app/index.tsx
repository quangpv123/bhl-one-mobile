import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';

export default function IndexScreen() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(app)' : '/login'} />;
}
