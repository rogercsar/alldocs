import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, FlatList, Image, TouchableOpacity } from 'react-native';

export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
};

type Props = {
  items?: Testimonial[];
  autoPlay?: boolean;
  interval?: number; // ms
};

const WINDOW_WIDTH = Dimensions.get('window').width || 360;
const CARD_MAX_WIDTH = 680;
const HORIZONTAL_PADDING = 16;

export default function TestimonialsCarousel({ items, autoPlay = true, interval = 4500 }: Props) {
  const data = useMemo<Testimonial[]>(
    () =>
      items ?? [
        {
          id: '1',
          quote:
            'O app mudou meu dia a dia. Sincroniza tudo e nunca mais perdi informações.',
          author: 'Mariana A.',
          role: 'PM, HealthTech',
          avatarUrl:
            'https://images.unsplash.com/photo-1550525811-e5869dd03032?w=200&h=200&fit=crop',
        },
        {
          id: '2',
          quote:
            'Consegui reduzir em 40% o retrabalho da equipe. A automação é fantástica.',
          author: 'Rafael S.',
          role: 'CTO, Fintech',
          avatarUrl:
            'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=200&h=200&fit=crop',
        },
        {
          id: '3',
          quote:
            'Interface simples, onboarding rápido e o suporte é excelente. Recomendo.',
          author: 'Beatriz R.',
          role: 'Founder, EdTech',
          avatarUrl:
            'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop',
        },
      ],
    [items]
  );

  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList<Testimonial>>(null);
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(WINDOW_WIDTH);

  useEffect(() => {
    if (!autoPlay || data.length <= 1) return;
    const id = setInterval(() => {
      const next = (index + 1) % data.length;
      flatRef.current?.scrollToOffset({ offset: next * pageWidth, animated: true });
      setIndex(next);
    }, interval);
    return () => clearInterval(id);
  }, [autoPlay, data.length, index, interval, pageWidth]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true }
  );

  const onMomentumScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex(newIndex);
  };

  const renderItem = ({ item, index: i }: { item: Testimonial; index: number }) => {
    const inputRange = [(i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.92, 1, 0.92],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ width: pageWidth, alignItems: 'center' }}>
        <Animated.View
          style={[
            styles.card,
            {
              width: Math.min(CARD_MAX_WIDTH, pageWidth - HORIZONTAL_PADDING * 2),
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : null}
          <Text style={styles.quote}>"{item.quote}"</Text>
          <Text style={styles.author}>{item.author}</Text>
          {item.role ? <Text style={styles.role}>{item.role}</Text> : null}
        </Animated.View>
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width || 0);
        if (w && w !== pageWidth) setPageWidth(w);
      }}
    >
      <Animated.FlatList
        ref={flatRef}
        data={data}
        keyExtractor={(it) => it.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        snapToInterval={pageWidth}
        decelerationRate={'fast'}
      />

      <View style={styles.dots}>
        {data.map((_, i) => {
          const inputRange = [(i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const dotScale = scrollX.interpolate({
            inputRange,
            outputRange: [1, 1.25, 1],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={String(i)}
              style={[styles.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]}
            />
          );
        })}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => {
            const prev = (index - 1 + data.length) % data.length;
            flatRef.current?.scrollToOffset({ offset: prev * pageWidth, animated: true });
            setIndex(prev);
          }}
          style={[styles.controlBtn, { marginRight: 8 }]}
        >
          <Text style={styles.controlText}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const next = (index + 1) % data.length;
            flatRef.current?.scrollToOffset({ offset: next * pageWidth, animated: true });
            setIndex(next);
          }}
          style={styles.controlBtn}
        >
          <Text style={styles.controlText}>Próximo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 24, marginBottom: 8 },
  card: {
    backgroundColor: '#0B0F1A',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 2,
    alignItems: 'center',
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginBottom: 12 },
  quote: {
    color: '#E6E8F0',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 12,
  },
  author: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  role: {
    color: '#AAB2C8',
    fontSize: 13,
    marginTop: 2,
  },
  dots: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9AA4B2',
    marginHorizontal: 4,
  },
  controls: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  controlText: { color: '#E6E8F0', fontSize: 13 },
});