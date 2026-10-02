import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import { useShopping } from '@/context/ShoppingContext';
import { useProducts } from '@/context/ProductsContext';
import { usePantry } from '@/context/PantryContext';
import { useAuth } from '@/context/AuthContext';
import { NewShoppingItem, LatestPrice, ShoppingItem } from '@/types';
import {
  subscribeToLatestPrices, bestRecent, fetchOpenPrices, mergePrices, loadPriceArea, savePriceArea,
} from '@/lib/prices';
import { searchProducts, ProductSuggestion } from '@/lib/productSearch';
import { showAlert } from '@/lib/alert';
import ShoppingRow from '@/components/ShoppingRow';
import PriceSheet from '@/components/PriceSheet';
import PriceAreaSheet from '@/components/PriceAreaSheet';
import ProfileButton from '@/components/ProfileButton';
import PrimaryButton from '@/components/PrimaryButton';

const ZONE_ICONS: Record<string, string> = { frigo: '❄️', freezer: '🧊', dispensa: '📦' };

interface Suggestion {
  key: string;
  item: NewShoppingItem;
  /** Etichetta secondaria (marca · formato). */
  sub: string;
  fromPantry: boolean;
  zoneIcon?: string;
}

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { activePantry } = usePantry();
  const { products } = useProducts();
  const { items, loading, openCount, addItem, toggleItem, setItemCount, removeItem, clearChecked } = useShopping();

  const [text, setText] = useState('');
  const [remote, setRemote] = useState<ProductSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [communityPrices, setCommunityPrices] = useState<Record<string, LatestPrice[]>>({});
  const [openPrices, setOpenPrices] = useState<Record<string, LatestPrice[]>>({});
  const [area, setArea] = useState<{ city: string; radiusKm: number } | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [priceItemId, setPriceItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const open = useMemo(() => items.filter((i) => !i.checked), [items]);
  const inCart = useMemo(() => items.filter((i) => i.checked), [items]);

  const query = text.trim();

  // Prezzi noti dei prodotti in lista (solo quelli con barcode: il testo
  // libero non ha un'identità comune a cui agganciarli). La chiave è una
  // stringa stabile, così l'ascolto non riparte a ogni modifica di quantità.
  const barcodesKey = useMemo(
    () => Array.from(new Set(items.map((i) => i.barcode).filter((b): b is string => !!b))).sort().join(','),
    [items],
  );
  useEffect(() => {
    if (!barcodesKey) { setCommunityPrices({}); return; }
    return subscribeToLatestPrices(
      barcodesKey.split(','),
      setCommunityPrices,
      (err) => console.warn('[prices]', err),
    );
  }, [barcodesKey]);

  useEffect(() => { loadPriceArea().then(setArea); }, []);

  // Prezzi di Open Prices entro il raggio dal comune: senza comune non si
  // cerca, e un errore (offline, servizio giù) lascia semplicemente i soli
  // prezzi della community.
  useEffect(() => {
    if (!barcodesKey || !area?.city) { setOpenPrices({}); return; }
    let cancelled = false;
    fetchOpenPrices(barcodesKey.split(','), area.city, area.radiusKm)
      .then((res) => { if (!cancelled) setOpenPrices(res); })
      .catch((e) => {
        if (cancelled) return;
        setOpenPrices({});
        if (e?.code === 'functions/invalid-argument') showAlert(t('common.error'), t('prices.areaError'));
        else console.warn('[openprices]', e);
      });
    return () => { cancelled = true; };
  }, [barcodesKey, area?.city, area?.radiusKm]);

  const pricesByBarcode = useMemo(() => mergePrices(communityPrices, openPrices), [communityPrices, openPrices]);

  const saveArea = (city: string, radiusKm: number) => {
    savePriceArea(city, radiusKm);
    setArea({ city, radiusKm });
    setAreaOpen(false);
  };

  // Il prezzo da mostrare sulla voce: il più basso tra quelli attuali; se
  // sono tutti vecchi, il più recente, che la voce segnala come datato.
  const priceFor = (i: ShoppingItem): LatestPrice | null => {
    const list = i.barcode ? pricesByBarcode[i.barcode] : undefined;
    if (!list || list.length === 0) return null;
    return bestRecent(list)
      ?? list.reduce((a, b) => (new Date(b.observedAt) > new Date(a.observedAt) ? b : a));
  };
  const priceItem = priceItemId ? items.find((i) => i.id === priceItemId) ?? null : null;

  // Ricerca su Open Food Facts con debounce: il servizio concede ~10
  // richieste al minuto, quindi si cerca solo quando l'utente si ferma.
  useEffect(() => {
    if (query.length < 3) {
      setRemote([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchProducts(query, ctrl.signal).then((res) => {
        if (ctrl.signal.aborted) return;
        setRemote(res);
        setSearching(false);
      });
    }, 700);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  // Prima ciò che hai già in casa (e che magari sta finendo), poi il
  // catalogo: sono i prodotti che davvero ricompri.
  const suggestions = useMemo<Suggestion[]>(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      if (out.length >= 3) break;
      if (!p.name.toLowerCase().includes(q)) continue;
      const k = p.barcode ?? p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        key: `p-${p.id}`,
        item: {
          name: p.name, brand: p.brand || undefined, qty: p.qty || undefined,
          barcode: p.barcode, category: p.category, tint: p.tint, zone: p.zone,
        },
        sub: [p.qty, p.brand].filter(Boolean).join(' · '),
        fromPantry: true,
        zoneIcon: ZONE_ICONS[p.zone],
      });
    }
    for (const r of remote) {
      if (seen.has(r.barcode)) continue;
      seen.add(r.barcode);
      out.push({
        key: `r-${r.barcode}`,
        item: { name: r.name, brand: r.brand || undefined, qty: r.qty || undefined, barcode: r.barcode },
        sub: [r.qty, r.brand].filter(Boolean).join(' · '),
        fromPantry: false,
      });
    }
    return out;
  }, [query, products, remote]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const add = async (data: NewShoppingItem) => {
    try {
      const res = await addItem(data);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      showToast(res === 'added'
        ? t('shopping.addedToast', { name: data.name })
        : t('shopping.incrementedToast', { name: data.name }));
      setText('');
      setRemote([]);
      // Il campo resta attivo: si aggiunge un articolo dopo l'altro senza
      // dover riaprire la tastiera.
      inputRef.current?.focus();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('shopping.addFailed'));
    }
  };

  const addFree = () => {
    if (!query) return;
    add({ name: query });
  };

  const confirmClear = () => {
    showAlert(
      t('shopping.clearCartTitle'),
      t('shopping.clearCartBody', { count: inCart.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('shopping.clearCart'), style: 'destructive', onPress: () => { clearChecked().catch(console.warn); } },
      ],
    );
  };

  const memberName = (uid?: string) => {
    if (!activePantry || !uid) return null;
    return uid === user?.uid
      ? t('product.addedByYou')
      : activePantry.members[uid]?.name ?? t('product.addedBySomeone');
  };

  const subtitle = loading
    ? ''
    : openCount > 0
      ? t('shopping.openCount', { count: openCount })
      : items.length > 0 ? t('shopping.allInCart') : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('shopping.title')}</Text>
            <View style={styles.subRow}>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              <TouchableOpacity onPress={() => setAreaOpen(true)} style={styles.scopeChip} activeOpacity={0.8}>
                <Ionicons name="location-outline" size={12} color={T.mute} />
                <Text style={styles.scopeChipText}>
                  {area?.city
                    ? t('prices.areaChip', { city: area.city, km: area.radiusKm })
                    : t('prices.areaChipEmpty')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/pantry')} style={styles.scopeChip} activeOpacity={0.8}>
                <Ionicons name={activePantry ? 'people-outline' : 'person-outline'} size={12} color={T.mute} />
                <Text style={styles.scopeChipText}>
                  {activePantry ? activePantry.name : t('home.scopePersonal')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <ProfileButton />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={T.primary} size="large" /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🛒</Text>
                <Text style={styles.emptyTitle}>{t('shopping.emptyTitle')}</Text>
                <Text style={styles.emptyBody}>{t('shopping.emptyBody')}</Text>
              </View>
            ) : (
              <>
                {open.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t('shopping.toBuy')}</Text>
                    </View>
                    <View style={styles.list}>
                      {open.map((i) => (
                        <ShoppingRow
                          key={i.id}
                          item={i}
                          addedByName={memberName(i.addedBy)}
                          price={priceFor(i)}
                          onPricePress={i.barcode ? () => setPriceItemId(i.id) : undefined}
                          onToggle={() => { toggleItem(i.id).catch(console.warn); }}
                          onCountChange={(c) => { setItemCount(i.id, c).catch(console.warn); }}
                          onRemove={() => { removeItem(i.id).catch(console.warn); }}
                        />
                      ))}
                    </View>
                  </>
                )}

                {inCart.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <TouchableOpacity
                        onPress={() => setCartOpen((v) => !v)}
                        style={styles.cartToggle}
                        activeOpacity={0.7}
                        accessibilityState={{ expanded: cartOpen }}
                      >
                        <Text style={styles.sectionTitle}>{t('shopping.inCart', { count: inCart.length })}</Text>
                        <Ionicons name={cartOpen ? 'chevron-up' : 'chevron-down'} size={15} color={T.mute} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={confirmClear} hitSlop={8}>
                        <Text style={styles.clearText}>{t('shopping.clearCart')}</Text>
                      </TouchableOpacity>
                    </View>
                    {cartOpen && (
                      <View style={styles.list}>
                        {inCart.map((i) => (
                          <ShoppingRow
                            key={i.id}
                            item={i}
                            addedByName={memberName(i.addedBy)}
                            price={priceFor(i)}
                            onPricePress={i.barcode ? () => setPriceItemId(i.id) : undefined}
                            onToggle={() => { toggleItem(i.id).catch(console.warn); }}
                            onCountChange={(c) => { setItemCount(i.id, c).catch(console.warn); }}
                            onRemove={() => { removeItem(i.id).catch(console.warn); }}
                          />
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Suggerimenti: sopra la barra, nella zona raggiungibile col pollice. */}
        {query.length > 0 && (
          <View style={styles.suggestions}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 250 }}>
              <TouchableOpacity style={styles.sugRow} onPress={addFree} activeOpacity={0.7}>
                <View style={[styles.sugIcon, { backgroundColor: T.primarySoft }]}>
                  <Ionicons name="add" size={18} color={T.primaryInk} />
                </View>
                <Text style={styles.sugName} numberOfLines={1}>{t('shopping.addFree', { text: query })}</Text>
              </TouchableOpacity>
              {suggestions.map((s) => (
                <TouchableOpacity key={s.key} style={styles.sugRow} onPress={() => add(s.item)} activeOpacity={0.7}>
                  <View style={styles.sugIcon}>
                    <Text style={{ fontSize: 15 }}>{s.zoneIcon ?? '🏷️'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sugName} numberOfLines={1}>{s.item.name}</Text>
                    {(s.sub || s.fromPantry) ? (
                      <Text style={styles.sugSub} numberOfLines={1}>
                        {[s.fromPantry ? t('shopping.fromPantry') : null, s.sub].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
              {searching && suggestions.every((s) => s.fromPantry) && (
                <View style={styles.sugSearching}>
                  <ActivityIndicator size="small" color={T.mute} />
                  <Text style={styles.sugSub}>{t('shopping.searching')}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <PriceSheet
          item={priceItem && priceItem.barcode ? priceItem : null}
          prices={priceItem?.barcode ? pricesByBarcode[priceItem.barcode] ?? [] : []}
          onClose={() => { setPriceItemId(null); loadPriceArea().then(setArea); }}
        />

        <PriceAreaSheet
          visible={areaOpen}
          city={area?.city ?? ''}
          radiusKm={area?.radiusKm ?? 15}
          onSave={saveArea}
          onClose={() => setAreaOpen(false)}
        />

        {toast && query.length === 0 && (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toast}><Text style={styles.toastText} numberOfLines={1}>{toast}</Text></View>
          </View>
        )}

        {/* Barra di aggiunta: sempre in basso, come l'azione primaria della home. */}
        <View style={styles.addBar}>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={t('shopping.addPlaceholder')}
              placeholderTextColor={T.mute}
              style={styles.input}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={addFree}
              autoCapitalize="sentences"
              accessibilityLabel={t('shopping.addPlaceholder')}
            />
            {text.length > 0 && (
              <TouchableOpacity onPress={() => setText('')} accessibilityLabel={t('common.close')}>
                <Ionicons name="close-circle" size={19} color={T.mute} />
              </TouchableOpacity>
            )}
          </View>
          {query.length > 0 ? (
            <PrimaryButton
              onPress={addFree}
              icon="add"
              shape="circle"
              size={50}
              radius={RADIUS.input}
              accessibilityLabel={t('shopping.a11y.add')}
            />
          ) : (
            <PrimaryButton
              onPress={() => { Keyboard.dismiss(); router.push({ pathname: '/scanner', params: { mode: 'shopping' } }); }}
              icon="barcode-outline"
              shape="circle"
              size={50}
              radius={RADIUS.input}
              accessibilityLabel={t('shopping.a11y.scan')}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 24 },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  subtitle: { fontSize: 14, color: T.ink2, fontFamily: FONTS.sansMedium },
  scopeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 9, borderRadius: RADIUS.tag,
    backgroundColor: 'rgba(40,50,35,0.06)',
  },
  scopeChipText: { fontSize: 12, color: T.mute, fontFamily: FONTS.sansMedium, maxWidth: 150 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginTop: 18, marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.sansBold, color: T.ink2 },
  cartToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearText: { fontSize: 13, fontFamily: FONTS.sansMedium, color: T.urgent },
  list: { paddingHorizontal: 16, gap: 10 },

  empty: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 70 },
  emptyEmoji: { fontSize: 54, marginBottom: 14 },
  emptyTitle: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, marginBottom: 8 },
  emptyBody: {
    fontFamily: FONTS.sans, fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 21,
  },

  suggestions: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: RADIUS.clay,
    backgroundColor: T.surface, boxShadow: CLAY.surface, overflow: 'hidden',
  },
  sugRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  sugIcon: {
    width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  sugName: { flex: 1, fontSize: 15, fontFamily: FONTS.sansSemiBold, color: T.ink },
  sugSub: { fontSize: 12, fontFamily: FONTS.sans, color: T.mute, marginTop: 1 },
  sugSearching: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14 },

  toastWrap: { alignItems: 'center', marginBottom: 8 },
  toast: {
    maxWidth: '86%', backgroundColor: T.primary, borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  toastText: { color: '#fbfaf3', fontSize: 13, fontFamily: FONTS.sansMedium },

  addBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 50, borderRadius: RADIUS.input, paddingHorizontal: 16,
    backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: FONTS.sans, color: T.ink,
    // Il bordo di focus di default su web stonerebbe con l'incavo.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
