import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { urgencyOf, shortDate, effectiveDays, effectiveExpiry } from '@/lib/urgency';
import FoodTile from '@/components/FoodTile';
import Pill from '@/components/Pill';
import ProfileButton from '@/components/ProfileButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { Product } from '@/types';

export default function NotificationsScreen() {
  const { products, removeProduct, changeZone, markConsumed } = useProducts();
  const router = useRouter();

  const scaduti  = products.filter((p) => effectiveDays(p) < 0);
  const oggi     = products.filter((p) => effectiveDays(p) === 0);
  const urgenti  = products.filter((p) => { const d = effectiveDays(p); return d > 0 && d <= 3; });
  const prossimi = products.filter((p) => { const d = effectiveDays(p); return d > 3 && d <= 7; });

  const isEmpty = scaduti.length + oggi.length + urgenti.length + prossimi.length === 0;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sub}>Avvisi & azioni</Text>
              <Text style={styles.title}>Da gestire oggi</Text>
            </View>
            <ProfileButton />
          </View>

          <View style={styles.chips}>
            {[
              { count: scaduti.length, label: 'scaduti', tone: 'urgent' as const },
              { count: oggi.length, label: 'oggi', tone: 'urgent' as const },
              { count: urgenti.length, label: 'entro 3 giorni', tone: 'warn' as const },
              { count: prossimi.length, label: 'questa settimana', tone: 'ok' as const },
            ].map((c) => c.count > 0 && (
              <SummaryChip key={c.label} count={c.count} label={c.label} tone={c.tone} />
            ))}
          </View>
        </View>

        {isEmpty && <EmptyState />}

        {scaduti.length > 0 && (
          <Section title="Scaduti">
            {scaduti.map((p) => (
              <PriorityCard key={p.id} product={p} urgency="scaduto"
                onOpen={() => router.push(`/product/${p.id}`)}
                onRemove={() => removeProduct(p.id)}
                onConsumed={() => markConsumed(p.id)}
              />
            ))}
          </Section>
        )}
        {oggi.length > 0 && (
          <Section title="Scadono oggi">
            {oggi.map((p) => (
              <PriorityCard key={p.id} product={p} urgency="oggi"
                onOpen={() => router.push(`/product/${p.id}`)}
                onFreeze={() => changeZone(p.id, 'freezer')}
                onConsumed={() => markConsumed(p.id)}
                onRecipe={() => router.push('/(tabs)/recipes')}
                canFreeze={['Pesce','Carne','Pane','Verdura'].includes(p.category)}
              />
            ))}
          </Section>
        )}
        {urgenti.length > 0 && (
          <Section title="Nei prossimi giorni">
            {urgenti.map((p) => (
              <PriorityCard key={p.id} product={p} urgency="urgente"
                onOpen={() => router.push(`/product/${p.id}`)}
                onFreeze={() => changeZone(p.id, 'freezer')}
                onConsumed={() => markConsumed(p.id)}
                onRecipe={() => router.push('/(tabs)/recipes')}
                canFreeze={['Pesce','Carne','Pane','Verdura'].includes(p.category)}
              />
            ))}
          </Section>
        )}
        {prossimi.length > 0 && (
          <Section title="Questa settimana">
            {prossimi.map((p) => (
              <CompactCard key={p.id} product={p}
                onOpen={() => router.push(`/product/${p.id}`)}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function SummaryChip({ count, label, tone }: { count: number; label: string; tone: 'urgent' | 'warn' | 'ok' }) {
  const pal = {
    urgent: { bg: T.urgentSoft, ink: '#4d1a10', dot: T.urgent },
    warn:   { bg: T.warnSoft,   ink: '#4a3414', dot: T.warn },
    ok:     { bg: T.okSoft,     ink: '#1b3320', dot: T.ok },
  }[tone];
  return (
    <View style={[styles.summaryChip, { backgroundColor: pal.bg }]}>
      <View style={[styles.dot, { backgroundColor: pal.dot }]} />
      <Text style={[styles.summaryText, { color: pal.ink }]}>
        <Text style={{ fontFamily: FONTS.sansBold }}>{count}</Text> {label}
      </Text>
    </View>
  );
}

interface PriorityCardProps {
  product: Product;
  urgency: string;
  onOpen: () => void;
  onRemove?: () => void;
  onConsumed?: () => void;
  onFreeze?: () => void;
  onRecipe?: () => void;
  canFreeze?: boolean;
}

function PriorityCard({ product, urgency, onOpen, onRemove, onConsumed, onFreeze, onRecipe, canFreeze }: PriorityCardProps) {
  const days = effectiveDays(product);
  const u = urgencyOf(days);

  const suggestion =
    urgency === 'scaduto' ? 'Verifica se è ancora sicuro o registralo come spreco.' :
    product.zone === 'frigo' && canFreeze ? 'Puoi congelarlo per estenderne la durata.' :
    product.category === 'Latticini' ? 'Perfetto per una frittata o un risotto.' :
    product.category === 'Verdura' ? 'Ottimo per un soffritto veloce o una vellutata.' :
    'Ti suggeriamo di consumarlo presto.';

  return (
    <View style={styles.priorityCard}>
      <View style={[styles.urgencyStrip, { backgroundColor: u.color }]} />
      <View style={{ padding: 14 }}>
        <TouchableOpacity
          style={styles.productRow}
          onPress={onOpen}
          activeOpacity={0.85}
        >
          <FoodTile product={product} size={56} radius={RADIUS.md} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.badgeRow}>
              <View style={[styles.urgencyBadge, { backgroundColor: u.soft }]}>
                <Text style={[styles.urgencyBadgeText, { color: u.ink }]}>{u.label.toUpperCase()}</Text>
              </View>
              <Text style={styles.zoneText}>{product.zone}</Text>
            </View>
            <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
            <Text style={styles.productSub}>{product.qty} · {product.brand}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.suggestion}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>✨</Text>
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </View>

        <View style={styles.actions}>
          {urgency === 'scaduto' ? (
            <>
              {onRemove && <Pill variant="danger" size="sm" onPress={onRemove}>🗑 Rimuovi</Pill>}
            </>
          ) : (
            <>
              {onRecipe && <Pill variant="primary" size="sm" onPress={onRecipe}>🔥 Cucina</Pill>}
              {canFreeze && onFreeze && <Pill variant="soft" size="sm" onPress={onFreeze}>🧊 Freezer</Pill>}
              {onConsumed && <Pill variant="ghost" size="sm" onPress={onConsumed}>✓ Consumato</Pill>}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function CompactCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const days = effectiveDays(product);
  const u = urgencyOf(days);
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={styles.compactCard}>
      <FoodTile product={product} size={48} radius={12} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productSub}>Scade {shortDate(effectiveExpiry(product))} · {product.zone}</Text>
      </View>
      <View style={[styles.urgencyBadge, { backgroundColor: u.soft }]}>
        <Text style={[styles.urgencyBadgeText, { color: u.ink }]}>{u.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 36 }}>🌿</Text>
      </View>
      <Text style={styles.emptyTitle}>Tutto sotto controllo</Text>
      <Text style={styles.emptyText}>Nessun prodotto in scadenza nei prossimi giorni.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 110 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  sub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44, marginTop: 2, marginBottom: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  summaryText: { fontSize: 12, fontFamily: FONTS.sansSemiBold },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  sectionList: { paddingHorizontal: 20, gap: 10 },

  priorityCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card,
  },
  urgencyStrip: { height: 4 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  urgencyBadge: { borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: 8 },
  urgencyBadgeText: { fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 0.3 },
  zoneText: { fontSize: 11, color: T.mute, fontFamily: FONTS.sans },
  productName: { fontSize: 16, fontFamily: FONTS.sansBold, color: T.ink, letterSpacing: -0.2 },
  productSub: { fontSize: 12, color: T.mute, marginTop: 2, fontFamily: FONTS.sans },
  suggestion: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: T.bg, borderRadius: 12, padding: 10, marginBottom: 10,
  },
  suggestionText: { fontSize: 12, color: T.ink2, lineHeight: 18, flex: 1, fontFamily: FONTS.sans },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  compactCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg,
    padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', ...SHADOW.card,
  },

  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 100, backgroundColor: T.okSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink, letterSpacing: -0.4 },
  emptyText: { fontSize: 13, color: T.mute, marginTop: 6, textAlign: 'center', fontFamily: FONTS.sans },
});
