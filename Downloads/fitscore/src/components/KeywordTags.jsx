import React from 'react'

export default function KeywordTags({ found = [], missing = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {found.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Found in your CV
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {found.map(k => (
              <span key={k} style={{
                fontSize: 12, padding: '4px 11px', borderRadius: 20,
                background: 'rgba(76,175,125,0.12)', color: '#4caf7d',
                border: '1px solid rgba(76,175,125,0.2)'
              }}>{k}</span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Missing — add these
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map(k => (
              <span key={k} style={{
                fontSize: 12, padding: '4px 11px', borderRadius: 20,
                background: 'rgba(255,79,79,0.1)', color: '#ff7070',
                border: '1px solid rgba(255,79,79,0.2)'
              }}>{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
