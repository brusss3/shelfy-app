// Recipes screen — suggestions based on expiring ingredients
function RecipesScreen({ products, openRecipeDetail }) {
  const allRecipes = SHELFY_DATA.recipes;

  // Compute matched expiring ingredients per recipe
  const ranked = allRecipes.map(r => {
    const expiring = r.uses.filter(name => {
      const p = products.find(pp => pp.name === name);
      return p && SHELFY_DATA.daysTo(p.expiry) <= 7;
    });
    return { recipe: r, expiring, matchCount: expiring.length };
  }).sort((a, b) => b.matchCount - a.matchCount);

  const featured = ranked[0];
  const rest = ranked.slice(1);

  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{ padding: '64px 20px 14px' }}>
        <div style={{ fontSize: 13, color: T.mute, fontWeight: 500 }}>Salva il cibo, ispirati</div>
        <h1 style={{
          fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontStyle: 'italic',
          fontSize: 40, color: T.ink, margin: '4px 0 0', padding: '0 0 4px',
          letterSpacing: -1, lineHeight: 1.2,
        }}>Ricette per te</h1>
        <div style={{ fontSize: 14, color: T.ink2, marginTop: 10, lineHeight: 1.4 }}>
          Basate su {featured ? featured.matchCount : 0} ingredienti in scadenza nella tua dispensa.
        </div>
      </div>

      {/* featured */}
      {featured && (
        <div style={{ padding: '0 20px 18px' }}>
          <FeaturedRecipe data={featured} products={products} onOpen={() => openRecipeDetail(featured.recipe.id)}/>
        </div>
      )}

      <SectionTitle action={<span style={{ fontSize: 12, color: T.primary, fontWeight: 600 }}>Tutte</span>}>
        Altre idee
      </SectionTitle>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rest.map(r => (
          <RecipeRow key={r.recipe.id} data={r} products={products}
            onOpen={() => openRecipeDetail(r.recipe.id)}/>
        ))}
      </div>
    </div>
  );
}

function FeaturedRecipe({ data, products, onOpen }) {
  const { recipe, expiring, matchCount } = data;
  return (
    <div onClick={onOpen} style={{
      borderRadius: 28, overflow: 'hidden', cursor: 'pointer',
      background: recipe.tint, position: 'relative',
      boxShadow: '0 12px 28px -16px rgba(40,50,35,0.35)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 65%)',
      }}/>

      <div style={{ position: 'relative', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{
            background: 'rgba(20,28,16,0.85)', color: '#fbfaf3', padding: '5px 10px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Icon name="sparkles" size={12} color="#fbfaf3"/> Suggerita
          </span>
          {matchCount > 0 && (
            <span style={{
              background: 'rgba(255,255,255,0.7)', color: '#1a2018',
              padding: '5px 10px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
            }}>{matchCount} in scadenza</span>
          )}
        </div>

        <div style={{
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
          fontSize: 36, color: '#1a2018', letterSpacing: -0.6, lineHeight: 1.05, marginTop: 22,
        }}>{recipe.title}</div>

        <div style={{ fontSize: 13, color: 'rgba(20,28,16,0.75)', marginTop: 6, lineHeight: 1.4 }}>
          {recipe.desc}
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 12, color: 'rgba(20,28,16,0.75)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="clock" size={14} color="rgba(20,28,16,0.65)"/> {recipe.time}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="flame" size={14} color="rgba(20,28,16,0.65)"/> {recipe.difficulty}
          </span>
        </div>

        {/* Ingredient row */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex' }}>
            {recipe.uses.slice(0, 3).map((name, i) => {
              const p = products.find(pp => pp.name === name);
              return (
                <div key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <FoodTile product={p || { name, tint: '#e6efde' }} size={36} radius={12}/>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: '#1a2018', fontWeight: 600, flex: 1 }}>
            {recipe.uses.length} ingredienti dalla tua dispensa
          </div>
          <div style={{
            background: T.primary, color: '#fbfaf3', borderRadius: 100, padding: '10px 14px',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Apri <Icon name="chevron-right" size={14} color="#fbfaf3"/>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipeRow({ data, products, onOpen }) {
  const { recipe, matchCount } = data;
  const inPantry = recipe.uses.filter(name => products.find(p => p.name === name)).length;

  return (
    <div onClick={onOpen} style={{
      background: T.surface, borderRadius: 18, padding: 12, display: 'flex', gap: 12, alignItems: 'center',
      boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
      cursor: 'pointer',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: recipe.tint, flexShrink: 0,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.6), transparent 60%)',
        }}/>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
          fontSize: 32, color: 'rgba(20, 28, 16, 0.78)', letterSpacing: -0.5,
        }}>{recipe.title[0]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipe.title}</div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: T.mute, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={11} color={T.mute}/> {recipe.time}</span>
          <span>{inPantry}/{recipe.uses.length} in dispensa</span>
        </div>
      </div>
      {matchCount > 0 && (
        <span style={{
          background: T.warnSoft, color: '#4a3414', borderRadius: 100, padding: '5px 10px',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
        }}>{matchCount} urgente{matchCount > 1 ? 'i' : ''}</span>
      )}
    </div>
  );
}

// Recipe Detail screen
function RecipeDetailScreen({ recipe, products, onBack }) {
  if (!recipe) return null;
  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* hero */}
      <div style={{
        height: 240, background: recipe.tint, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), transparent 65%)',
        }}/>
        <div style={{ position: 'absolute', top: 60, left: 16 }}>
          <button onClick={onBack} style={iconBtn}>
            <Icon name="chevron-left" size={22} color={T.ink}/>
          </button>
        </div>
        <div style={{
          position: 'absolute', bottom: 24, left: 24, right: 24,
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
          fontSize: 38, color: '#1a2018', letterSpacing: -0.6, lineHeight: 1,
        }}>{recipe.title}</div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13, color: T.ink2, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={15} color={T.ink2}/> {recipe.time}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="flame" size={15} color={T.ink2}/> {recipe.difficulty}</span>
        </div>
        <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.5, marginBottom: 20 }}>{recipe.desc}</div>
      </div>

      <SectionTitle>Ingredienti</SectionTitle>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
        {recipe.uses.map(name => {
          const p = products.find(pp => pp.name === name);
          const has = !!p;
          const days = p ? SHELFY_DATA.daysTo(p.expiry) : null;
          return (
            <Card key={name} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <FoodTile product={p || { name, tint: '#eceee5' }} size={42} radius={12}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{name}</div>
                {has ? (
                  <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>
                    {p.qty} · scade {shortDate(p.expiry)}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>Non in dispensa</div>
                )}
              </div>
              {has ? (
                <span style={{
                  background: days <= 3 ? T.warnSoft : T.okSoft,
                  color: days <= 3 ? '#4a3414' : '#1b3320',
                  borderRadius: 100, padding: '4px 9px', fontSize: 11, fontWeight: 700,
                }}>{days <= 3 ? 'usa subito' : 'ok'}</span>
              ) : (
                <button style={{
                  background: T.primarySoft, color: T.primaryInk, border: 'none',
                  borderRadius: 100, padding: '5px 10px', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Icon name="plus" size={12} color={T.primaryInk}/> Lista
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle>Procedimento</SectionTitle>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {recipe.steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, background: T.surface, borderRadius: 18, padding: 14,
            boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 100, background: T.primary,
              color: '#fbfaf3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
              fontSize: 17, flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{step}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <Pill variant="primary" size="lg" style={{ width: '100%', justifyContent: 'center' }}>
          <Icon name="check" size={18} color="#fbfaf3"/> Segna come cucinata
        </Pill>
      </div>
    </div>
  );
}

window.RecipesScreen = RecipesScreen;
window.RecipeDetailScreen = RecipeDetailScreen;
