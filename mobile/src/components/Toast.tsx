import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, Text } from 'react-native';
import { colors } from '../theme/colors';

export type ToastType = 'success' | 'error' | 'info';

type ToastContextValue = {
  showToast: (message: string, opts?: { type?: ToastType; duration?: number }) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string>('');
  const [type, setType] = useState<ToastType>('info');
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const bg = useMemo(() => {
    switch (type) {
      case 'success': return colors.success || '#10B981';
      case 'error': return colors.danger || '#EF4444';
      default: return '#111827';
    }
  }, [type]);

  const showToast = useCallback((msg: string, opts?: { type?: ToastType; duration?: number }) => {
    const duration = opts?.duration ?? 2500;
    const t = opts?.type ?? 'info';
    setMessage(msg);
    setType(t);
    setVisible(true);
    // clear existing timer
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // fade in
    Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    // auto-hide
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, duration);
  }, [opacity]);

  const hideToast = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    Animated.timing(opacity, { toValue: 0, duration: 160, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [opacity]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {/* Overlay Toast */}
        {visible ? (
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', bottom: Platform.select({ web: 24, default: 16 }) as number, left: 16, right: 16, opacity }}
          >
            <View style={{ backgroundColor: bg, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{message}</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}