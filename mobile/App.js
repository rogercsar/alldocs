import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LockScreen from './src/screens/LockScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import EditDocumentScreen from './src/screens/EditDocumentScreen';
import ViewDocumentScreen from './src/screens/ViewDocumentScreen';
import UpgradeScreen from './src/screens/UpgradeScreen';
import { supabase } from './src/supabase';

const Stack = createNativeStackNavigator();

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || 'anonymous');
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || 'anonymous');
    });
    return () => { sub.subscription?.unsubscribe?.(); };
  }, []);

  if (!unlocked) {
    return <LockScreen onUnlocked={() => setUnlocked(true)} />;
  }

  if (!ready) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!userId || userId === 'anonymous' ? (
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
            {(props) => <OnboardingScreen onDone={() => props.navigation.replace('Dashboard')} />}
          </Stack.Screen>
        ) : null}
        <Stack.Screen name="Dashboard" options={{ title: 'AllDocs' }}>
          {(props) => (
            <DashboardScreen
              onAdd={() => props.navigation.navigate('Edit')}
              onOpen={(doc) => props.navigation.navigate('View', { doc })}
              onUpgrade={() => props.navigation.navigate('Upgrade')}
              userId={userId}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Edit" options={{ title: 'Adicionar Documento' }}>
          {(props) => <EditDocumentScreen onSaved={() => props.navigation.navigate('Dashboard')} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="View" options={{ title: 'Documento' }}>
          {(props) => (
            <ViewDocumentScreen
              doc={props.route.params.doc}
              userId={userId}
              onBack={() => props.navigation.goBack()}
              onDeleted={() => props.navigation.navigate('Dashboard')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Upgrade" options={{ title: 'Upgrade' }}>
          {(props) => <UpgradeScreen onClose={() => props.navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
