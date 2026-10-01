import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import { LatestPrice, ShoppingItem, Store, StoreInput } from '@/types';
import {
  CHAINS, RECENT_DAYS, STALE_DAYS, ageLabel, bestRecent, formatPrice, getStoresInCity,
  loadPricePrefs, recencyOf, savePricePrefs, storeLabel, submitPrice,
} from '@/lib/prices';
import { showAlert } from '@/lib/alert';
import PrimaryButton from './PrimaryButton';

interface Props {
  item: ShoppingItem | null;
  prices: LatestPrice[];
  onClose: () => void;
}

const DATE_CHOICES = [
  { days: 0, key: 'today' },
  { days: 1, key: 'yesterday' },
  { days: 3, key: 'threeDays' },
  { days: 7, key: 'week' },
] as const;

const sameStore = (a: StoreInput, b: StoreInput) =>
  a.chain.toLowerCase() === b.chain.toLowerCase()
  && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

export default function PriceSheet({ item, prices, onClose }: Props) {
  const { t } = useTranslation();
  const visible = item !== null;

  const [adding, setAdding] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [city, setCity] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [lastStore, setLastStore] = useState<StoreInput | null>(null);
  const [store, setStore] = useState<StoreInput | null>(null);
  const [newStore, setNewStore] = useState(false);
  const [chain, setChain] = useState('');
  const [customChain, setCustomChain] = useState(false);
  const [area, setArea] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [saving, setSaving] = useState(false);

  const best = useMemo(() => bestRecent(prices), [prices]);

  const fetchStores = async (c: string) => {
    if (!c.trim()) { setStores([]); return; }
    setLoadingStores(true);
    try { setStores(await getStoresInCity(c)); } catch { setStores([]); }
    setLoadingStores(false);
  };

  // Ogni apertura riparte da zero; senza prezzi noti il modulo è già aperto,
  // perché è l'unica cosa utile da fare.
  useEffect(() => {
    if (!item) return;
    setAdding(prices.length === 0);
    setPriceText('');
    setStore(null);
    setNewStore(false);
    setChain('');
    setCustomChain(false);
    setArea('');
    setDaysAgo(0);
    let cancelled = false;
    loadPricePrefs().then((p) => {
      if (cancelled) return;
      setCity(p.city);
      setLastStore(p.lastStore);
      if (p.lastStore && p.city) setStore(p.lastStore);
      fetchStores(p.city);
    });
    return () => { cancelled = true; };
    // Solo alla (ri)apertura per un prodotto: `prices` cambia in tempo reale
    // e non deve azzerare ciò che l'utente sta scrivendo.
  }, [item?.id]);

  if (!item) return null;

  const priceCents = (() => {
    const n = parseFloat(priceText.replace(',', '.'));
    return Number.isFinite(n) && n >= 0.01 && n <= 999 ? Math.round(n * 100) : null;
  })();

  // Il negozio effettivo: uno scelto dall'elenco, oppure quello che si sta
  // descrivendo nel modulo "nuovo negozio".
  const effectiveStore: StoreInput | null = newStore
    ? (chain.trim() ? { chain: chain.trim(), name: area.trim(), city: city.trim() } : null)
    : store ? { ...store, city: city.trim() } : null;

  const canSave = priceCents !== null && effectiveStore !== null && city.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave || !item.barcode || priceCents === null || !effectiveStore) return;
    setSaving(true);
    try {
      const res = await submitPrice({
        barcode: item.barcode,
        productName: [item.brand, item.name].filter(Boolean).join(' '),
        priceCents,
        store: effectiveStore,
        observedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      });
      savePricePrefs(city.trim(), effectiveStore);
      if (res.status === 'held') {
        showAlert(t('prices.heldTitle'), t('prices.heldBody'));
      } else {
        showAlert(t('prices.savedTitle'), t('prices.savedBody'));
      }
      onClose();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('prices.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const knownStores: StoreInput[] = [
    ...(lastStore && lastStore.city.trim().toLowerCase() === city.trim().toLowerCase() ? [lastStore] : []),
    ...stores.map((s) => ({ chain: s.chain, name: s.name, city: s.city })),
  ].filter((s, i, arr) => arr.findIndex((o) => sameStore(o, s)) === i);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
                {[item.qty, item.brand].filter(Boolean).length > 0 && (
                  <Text style={styles.sub} numberOfLines={1}>{[item.qty, item.brand].filter(Boolean).join(' · ')}</Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={24} color={T.ink2} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {prices.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {prices.map((p) => {
                    const rec = recencyOf(p.observedAt);
                    const isBest = best?.id === p.id;
                    return (
                      <View key={p.id} style={[styles.priceRow, rec === 'stale' && { opacity: 0.6 }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.storeLine}>
                            <Text style={styles.storeName} numberOfLines={1}>{storeLabel(p)}</Text>
                            {isBest && (
                              <View style={styles.bestTag}><Text style={styles.bestTagText}>{t('prices.lowest')}</Text></View>
                            )}
                          </View>
                          <Text style={[styles.age, rec === 'old' && { color: T.warn }, rec === 'stale' && { color: T.urgent }]}>
                            {rec === 'stale'
                              ? t('prices.staleNote', { age: ageLabel(p.observedAt) })
                              : t('prices.updated', { age: ageLabel(p.observedAt) })}
                            {p.confirmations > 1 ? ` · ${t('prices.confirmed', { count: p.confirmations })}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.price}>{formatPrice(p.priceCents)}</Text>
                      </View>
                    );
                  })}
                  <Text style={styles.hint}>
                    {t('prices.recencyHint', { recent: RECENT_DAYS, stale: STALE_DAYS })}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>{t('prices.emptyTitle')}</Text>
                  <Text style={styles.emptyBody}>{t('prices.emptyBody')}</Text>
                </View>
              )}

              {!adding ? (
                <TouchableOpacity style={styles.addToggle} onPress={() => setAdding(true)} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color={T.primary} />
                  <Text style={styles.addToggleText}>{t('prices.add')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.form}>
                  <Text style={styles.label}>{t('prices.priceLabel')}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={priceText}
                      onChangeText={setPriceText}
                      placeholder="1,29"
                      placeholderTextColor={T.mute}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      autoFocus={prices.length === 0}
                    />
                    <Text style={styles.currency}>€</Text>
                  </View>

                  <Text style={styles.label}>{t('prices.cityLabel')}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      onEndEditing={() => fetchStores(city)}
                      placeholder={t('prices.cityPlaceholder')}
                      placeholderTextColor={T.mute}
                      style={styles.input}
                      autoCapitalize="words"
                    />
                  </View>

                  <Text style={styles.label}>{t('prices.storeLabel')}</Text>
                  {loadingStores ? (
                    <ActivityIndicator size="small" color={T.mute} style={{ alignSelf: 'flex-start' }} />
                  ) : (
                    <View style={styles.chips}>
                      {knownStores.map((s) => {
                        const active = !newStore && store !== null && sameStore(store, s);
                        return (
                          <TouchableOpacity
                            key={`${s.chain}|${s.name}`}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => { setNewStore(false); setStore(s); }}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{storeLabel({ chain: s.chain, storeName: s.name })}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[styles.chip, newStore && styles.chipActive]}
                        onPress={() => { setNewStore(true); setStore(null); }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.chipText, newStore && styles.chipTextActive]}>{t('prices.newStore')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {newStore && (
                    <View style={styles.newStore}>
                      <View style={styles.chips}>
                        {CHAINS.map((c) => {
                          const active = !customChain && chain === c;
                          return (
                            <TouchableOpacity
                              key={c}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => { setCustomChain(false); setChain(c); }}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={[styles.chip, customChain && styles.chipActive]}
                          onPress={() => { setCustomChain(true); setChain(''); }}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.chipText, customChain && styles.chipTextActive]}>{t('prices.otherChain')}</Text>
                        </TouchableOpacity>
                      </View>
                      {customChain && (
                        <View style={styles.inputWrap}>
                          <TextInput
                            value={chain}
                            onChangeText={setChain}
                            placeholder={t('prices.chainPlaceholder')}
                            placeholderTextColor={T.mute}
                            style={styles.input}
                            maxLength={30}
                            autoCapitalize="words"
                          />
                        </View>
                      )}
                      <View style={styles.inputWrap}>
                        <TextInput
                          value={area}
                          onChangeText={setArea}
                          placeholder={t('prices.areaPlaceholder')}
                          placeholderTextColor={T.mute}
                          style={styles.input}
                          maxLength={60}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  )}

                  <Text style={styles.label}>{t('prices.dateLabel')}</Text>
                  <View style={styles.chips}>
                    {DATE_CHOICES.map((d) => {
                      const active = daysAgo === d.days;
                      return (
                        <TouchableOpacity
                          key={d.key}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setDaysAgo(d.days)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`prices.date.${d.key}`)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <PrimaryButton
                    onPress={save}
                    label={t('prices.save')}
                    disabled={!canSave}
                    loading={saving}
                    fullWidth
                    containerStyle={{ marginTop: 18 }}
                  />
                  <Text style={styles.privacy}>{t('prices.privacy')}</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,28,18,0.42)', justifyContent: 'flex-end' },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560, maxHeight: '88%',
    backgroundColor: T.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: T.line, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  sub: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 14 },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: RADIUS.md, padding: 14, boxShadow: CLAY.chip,
  },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeName: { flexShrink: 1, fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  bestTag: { backgroundColor: T.okSoft, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 },
  bestTagText: { fontFamily: FONTS.sansBold, fontSize: 10, color: T.ok },
  age: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 3 },
  price: { fontFamily: FONTS.sansBold, fontSize: 18, color: T.ink },
  hint: { fontFamily: FONTS.sans, fontSize: 11, color: T.mute, textAlign: 'center', marginTop: 2 },

  emptyBox: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.ink, marginBottom: 6 },
  emptyBody: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, textAlign: 'center', lineHeight: 19 },

  addToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: T.line,
  },
  addToggleText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.primary },

  form: { gap: 8 },
  label: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2, marginTop: 8, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: RADIUS.input,
    paddingHorizontal: 16, backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: FONTS.sans, color: T.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  currency: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.mute, marginLeft: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.md,
    backgroundColor: T.surface, boxShadow: CLAY.chip,
  },
  chipActive: { backgroundColor: T.primary },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink },
  chipTextActive: { color: '#fbfaf3' },
  newStore: { gap: 10, marginTop: 4 },
  privacy: { fontFamily: FONTS.sans, fontSize: 11, color: T.mute, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
