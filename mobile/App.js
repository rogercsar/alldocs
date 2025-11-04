import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LockScreen from './src/screens/LockScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import EditDocumentScreen from './src/screens/EditDocumentScreen';
import ViewDocumentScreen from './src/screens/ViewDocumentScreen';
import UpgradeScreen from './src/screens/UpgradeScreen';
import LandingScreen from './src/screens/LandingScreen';
import PlansScreen from './src/screens/PlansScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { supabase } from './src/supabase';
import { registerDeviceForUser, getDeviceLockEnabled } from './src/utils/device';
import { ToastProvider } from './src/components/Toast';
import { configureNotificationHandler, ensureNotificationPermission } from './src/utils/notifications';
import DevicesScreen from './src/screens/DevicesScreen';
import { Text, TextInput } from 'react-native';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';

const Stack = createNativeStackNavigator();

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState('');
  const [lockEnabled, setLockEnabled] = useState(true);
  const navRef = useRef(null);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      if (!Text.defaultProps) Text.defaultProps = {};
      Text.defaultProps.style = [{ fontFamily: 'Nunito_400Regular' }, Text.defaultProps.style];
      if (!TextInput.defaultProps) TextInput.defaultProps = {};
      TextInput.defaultProps.style = [{ fontFamily: 'Nunito_400Regular' }, TextInput.defaultProps.style];
    }
  }, [fontsLoaded]);

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

  useEffect(() => {
    (async () => {
      try {
        const enabled = await getDeviceLockEnabled();
        setLockEnabled(enabled);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (userId && userId !== 'anonymous') {
      (async () => {
        try {
          const res = await registerDeviceForUser(userId);
          if (res && res.status === 409) {
            navRef.current?.navigate?.('Upgrade');
          }
        } catch {}
      })();
    }
  }, [userId]);

  useEffect(() => {
    configureNotificationHandler();
    ensureNotificationPermission().catch(() => {});
  }, []);

  if (!ready || !fontsLoaded) return null;

  const isAnonymous = !userId || userId === 'anonymous';
  if (!isAnonymous && lockEnabled && !unlocked) {
    return <LockScreen onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <ToastProvider>
      <NavigationContainer ref={navRef}>
        <Stack.Navigator initialRouteName={isAnonymous ? 'Landing' : 'Dashboard'} screenOptions={{ headerTitleStyle: { fontFamily: 'Nunito_600SemiBold' } }}>
        {isAnonymous ? (
          <>
            <Stack.Screen name="Landing" options={{ headerShown: false }}>
              {(props) => (
                <LandingScreen
                  {...props}
                  onLogin={(mode) => props.navigation.navigate(mode === 'login' ? 'Login' : 'Signup')}
                  onViewPlans={() => props.navigation.navigate('Plans')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
              {(props) => <OnboardingScreen onDone={() => props.navigation.replace('Dashboard')} />}
            </Stack.Screen>
            <Stack.Screen name="Plans" options={{ title: 'Planos' }}>
              {(props) => <PlansScreen navigation={props.navigation} />}
            </Stack.Screen>
          </>
        ) : null}

        <Stack.Screen name="Dashboard" options={{ headerShown: true }}>
          {(props) => (
            <DashboardScreen
              onAdd={() => props.navigation.navigate('Edit')}
              onOpen={(doc) => props.navigation.navigate('View', { doc })}
              onUpgrade={(tab) => props.navigation.navigate('Upgrade', { initialTab: tab })}
              onLogout={() => supabase.auth.signOut().then(() => props.navigation.replace('Onboarding'))}
              userId={userId}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Edit" options={{ title: 'Adicionar Documento' }}>
          {(props) => <EditDocumentScreen onSaved={() => props.navigation.navigate('Dashboard')} userId={userId} document={props.route.params?.doc} />}
        </Stack.Screen>
        <Stack.Screen name="View" options={{ title: 'Documento' }}>
          {(props) => (
            <ViewDocumentScreen
              document={props.route.params.doc}
              userId={userId}
              onEdit={() => props.navigation.navigate('Edit', { doc: props.route.params.doc })}
              onDeleted={() => props.navigation.navigate('Dashboard')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Upgrade" options={{ title: 'Upgrade' }}>
          {(props) => <UpgradeScreen initialTab={props.route?.params?.initialTab} onClose={() => props.navigation.replace('Dashboard')} />}
        </Stack.Screen>
        <Stack.Screen name="Login" options={{ headerTitle: 'Entrar', headerBackTitle: 'Voltar' }}>
          {(props) => (
            <LoginScreen {...props} onDone={() => props.navigation.replace('Dashboard')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Signup" options={{ headerTitle: 'Criar conta', headerBackTitle: 'Voltar' }}>
          {(props) => (
            <SignupScreen
              {...props}
              onDone={() => props.navigation.replace(
                props.route?.params?.redirectToUpgrade ? 'Upgrade' : 'Dashboard',
                props.route?.params?.redirectToUpgrade ? { initialTab: 'premium' } : undefined
              )}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Devices" options={{ title: 'Dispositivos' }}>
          {(props) => <DevicesScreen navigation={props.navigation} />}
        </Stack.Screen>
        <Stack.Screen name="Profile" options={{ headerTitle: 'Perfil' }}>
          {(props) => (
            <ProfileScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Notifications" options={{ headerTitle: 'Notificações' }}>
          {(props) => (
            <NotificationsScreen {...props} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
    </ToastProvider>
  );
}
