// Shelfy — root app with simple state-based router
const { useState, useEffect, useMemo } = React;

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "palette": "moss",
    "displayFont": "serif-italic",
    "density": "regular",
    "tileShape": "rounded",
    "showGreeting": true,
    "accentTint": "warm"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply palette to theme tokens (mutates T in place — components read from it)
  applyPalette(t.palette, t.accentTint);

  const [products, setProducts] = useState(SHELFY_DATA.products);
  const [route, setRoute] = useState({ screen: 'home' });
  const [scanned, setScanned] = useState(null);

  // Navigation helpers
  const go = (screen, params = {}) => setRoute({ screen, ...params });
  const openProduct = (id) => go('detail', { productId: id });
  const openRecipe  = (id) => go('recipe', { recipeId: id });
  const startScan   = () => go('scanner');

  const currentProduct = useMemo(
    () => products.find(p => p.id === route.productId),
    [route.productId, products]
  );
  const currentRecipe = useMemo(
    () => SHELFY_DATA.recipes.find(r => r.id === route.recipeId),
    [route.recipeId]
  );

  const handleAction = (productId, action) => {
    if (action === 'consumed' || action === 'remove') {
      setProducts(ps => ps.filter(p => p.id !== productId));
    } else if (action === 'freeze') {
      setProducts(ps => ps.map(p => p.id === productId ? { ...p, zone: 'freezer' } : p));
    }
  };

  const handleSaveNew = (data) => {
    const id = 'p' + (Math.random().toString(36).slice(2, 7));
    setProducts(ps => [{
      id, name: data.name, brand: data.brand, qty: data.qty,
      zone: data.zone, expiry: data.expiry,
      added: new Date().toISOString().slice(0, 10),
      barcode: data.barcode || '',
      category: data.category || 'Altro',
      tint: data.tint || T.primarySoft, cal: 0,
    }, ...ps]);
    setScanned(null);
    go('home');
  };

  // ────── Render layered screens
  // Bottom nav visible on home/notifications/recipes
  const bottomNavVisible = ['home', 'notifications', 'recipes'].includes(route.screen);

  // density tweaks → font size base
  const baseFs = t.density === 'comfy' ? 16 : 15;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      fontFamily: 'DM Sans, ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontSize: baseFs, color: T.ink,
      WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
      '--tile-radius': t.tileShape === 'square' ? '6px' : t.tileShape === 'circle' ? '50%' : '14px',
    }}>
      {/* Pass tweaks-derived display font into a CSS var */}
      <style>{`
        h1, h2, h3, .display {
          font-family: ${t.displayFont === 'sans'
            ? '"DM Sans", system-ui, sans-serif'
            : '"Instrument Serif", "Times New Roman", serif'} !important;
          font-style: ${t.displayFont === 'serif-italic' ? 'italic' : 'normal'} !important;
        }
      `}</style>

      {/* main screen */}
      {route.screen === 'home' && (
        <HomeScreen products={products} setScreen={go}
          openProduct={openProduct} startScan={startScan}/>
      )}
      {route.screen === 'notifications' && (
        <NotificationsScreen products={products}
          openProduct={openProduct} openRecipe={() => go('recipes')}
          onAction={handleAction}/>
      )}
      {route.screen === 'recipes' && (
        <RecipesScreen products={products} openRecipeDetail={openRecipe}/>
      )}
      {route.screen === 'detail' && (
        <DetailScreen product={currentProduct} onBack={() => go('home')}
          onDelete={(id) => { setProducts(ps => ps.filter(p => p.id !== id)); go('home'); }}
          onMoveZone={(zone) => {
            setProducts(ps => ps.map(p => p.id === route.productId ? { ...p, zone } : p));
          }}/>
      )}
      {route.screen === 'recipe' && (
        <RecipeDetailScreen recipe={currentRecipe} products={products} onBack={() => go('recipes')}/>
      )}
      {route.screen === 'add' && (
        <AddScreen scanned={scanned}
          onCancel={() => { setScanned(null); go('home'); }}
          onSave={handleSaveNew}/>
      )}
      {route.screen === 'scanner' && (
        <ScannerScreen onCancel={() => go('home')}
          onFound={(prod) => { setScanned(prod); go('add'); }}/>
      )}

      {/* Bottom nav (above main but below scanner) */}
      {bottomNavVisible && (
        <BottomNav screen={route.screen} setScreen={go}/>
      )}

      {/* Center scan button overlay on bottom nav */}
      {bottomNavVisible && (
        <button onClick={startScan} style={{
          position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          width: 56, height: 56, borderRadius: 100, background: T.primary,
          color: '#fbfaf3', border: '4px solid ' + T.bg, cursor: 'pointer', zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 22px -8px rgba(20,40,18,0.55), 0 2px 4px rgba(0,0,0,0.15)',
        }}>
          <Icon name="scan" size={26} color="#fbfaf3"/>
        </button>
      )}

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="Aspetto">
          <TweakColor label="Tema" value={paletteSwatches[t.palette]}
            options={Object.values(paletteSwatches)}
            onChange={(v) => {
              const key = Object.keys(paletteSwatches).find(k => JSON.stringify(paletteSwatches[k]) === JSON.stringify(v));
              setTweak('palette', key || 'moss');
            }}/>
          <TweakRadio label="Tono sfondo" value={t.accentTint}
            options={['cool','warm']}
            onChange={(v) => setTweak('accentTint', v)}/>
        </TweakSection>
        <TweakSection label="Tipografia">
          <TweakSelect label="Stile titoli" value={t.displayFont}
            options={[
              { value: 'serif-italic', label: 'Serif corsivo' },
              { value: 'serif-roman',  label: 'Serif tondo' },
              { value: 'sans',         label: 'Sans-serif'  },
            ]}
            onChange={(v) => setTweak('displayFont', v)}/>
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio label="Densità" value={t.density}
            options={['regular','comfy']}
            onChange={(v) => setTweak('density', v)}/>
          <TweakSelect label="Forma tile" value={t.tileShape}
            options={[
              { value: 'rounded', label: 'Smussata' },
              { value: 'square',  label: 'Quadrata' },
              { value: 'circle',  label: 'Cerchio'  },
            ]}
            onChange={(v) => setTweak('tileShape', v)}/>
          <TweakToggle label="Saluto" value={t.showGreeting}
            onChange={(v) => setTweak('showGreeting', v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// Palette presets (swatches for the TweakColor picker)
const paletteSwatches = {
  moss:     ['#2f4a31', '#dde6d6', '#f5f3ec'],
  sage:     ['#5d7a4d', '#d4dcc7', '#f3f1e8'],
  forest:   ['#1f3a23', '#cfd9c6', '#eeece4'],
  charcoal: ['#3a3b35', '#d9d8cf', '#f0eee5'],
};

function applyPalette(key, tint) {
  const presets = {
    moss:     { primary: '#2f4a31', primaryInk: '#0d1f10', primarySoft: '#dde6d6', sage: '#bdc9ad' },
    sage:     { primary: '#5d7a4d', primaryInk: '#1d2e16', primarySoft: '#d4dcc7', sage: '#a7bb8e' },
    forest:   { primary: '#1f3a23', primaryInk: '#08160a', primarySoft: '#cfd9c6', sage: '#a9bd9b' },
    charcoal: { primary: '#3a3b35', primaryInk: '#1a1b18', primarySoft: '#d9d8cf', sage: '#b8b7ad' },
  };
  const p = presets[key] || presets.moss;
  Object.assign(T, p);
  // Tint
  T.bg = tint === 'cool' ? '#eff2ec' : '#f5f3ec';
}

window.App = App;
